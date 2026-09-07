'use client'

import {
  DEFAULT_ANGLE_STEP,
  emitter,
  type GridEvent,
  type LevelNode,
  sceneRegistry,
  snapPointAlongAngleRay,
  snapPointToGrid,
  useScene,
} from '@pascal-app/core'
import {
  CursorSphere,
  clearPlacementSurface,
  clearSlabSnapFeedback,
  EDITOR_LAYER,
  type HorizontalConstructionPlane,
  isAngleSnapActive,
  isGridSnapActive,
  markToolCancelConsumed,
  publishHorizontalConstructionPlane,
  publishPlacementSurface,
  resampleTerrainConstructionPlane,
  resolveEventConstructionPlane,
  resolvePointerSupportSurface,
  resolveSlabPlanPointSnap,
  triggerSFX,
  useEditor,
  useFloorplanDraftPreview,
} from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferGeometry, DoubleSide, type Group, Line, Shape, Vector3 } from 'three'
import { LineBasicNodeMaterial } from 'three/webgpu'
import { advanceFreehandPoolStroke, buildFreehandPoolOutline } from '../design/freehand-outline'
import { findPoolHostSlabId, localizePoolPolygon } from '../design/opening-sync'
import { worldPointToPoolLevel } from '../design/level-coordinates'
import { PoolLevelPreviewGroup } from './level-preview-group'
import { PoolNode } from '../core/schema'
import {
  createPoolShapePolygon,
  getPoolPolygonDimensions,
  isDrawnPoolShape,
  isPoolPolygonPlaceable,
  type PoolShape,
} from '../design/shapes'
import { usePoolStore } from './store'
import { findSharedPoolJoint } from '../design/shared-joint'
import { PoolSharedJointNode } from '../shared-joint/core/schema'
import { countNodesByType, createPoolPluginNode, getPoolNodes } from './scene-nodes'

type Point = [number, number]

const Y_OFFSET = 0.02
const FREEHAND_CLOSE_DISTANCE = 0.25
const FREEHAND_SAMPLE_DISTANCE = 0.08
const FREEHAND_SIMPLIFY_TOLERANCE = 0.12
const SURFACE_UP = new Vector3(0, 1, 0)
const surfacePointScratch = new Vector3()

function commitPoolDrawing(
  levelId: LevelNode['id'],
  points: Point[],
  constructionPlane: HorizontalConstructionPlane | null,
  elevation: number,
  placement: {
    shape: PoolShape
    length: number
    width: number
    outlineControlPoints?: Point[]
  },
) {
  const scene = useScene.getState()
  const settings = usePoolStore.getState()
  const { polygon, position: localizedPosition } = localizePoolPolygon(points)
  const position: [number, number, number] = [
    localizedPosition[0],
    elevation,
    localizedPosition[2],
  ]
  const outlineControlPoints = placement.outlineControlPoints?.map(
    ([x, z]): Point => [
      Number((x - localizedPosition[0]).toFixed(6)),
      Number((z - localizedPosition[2]).toFixed(6)),
    ],
  )
  const detectedSlabId = findPoolHostSlabId(
    scene.nodes,
    levelId,
    points,
    settings.shellThickness + settings.openingClearance,
  )
  const supportSlabId = constructionPlane?.supportSlabId ?? detectedSlabId
  const poolCount = countNodesByType(scene.nodes, 'pool:pool')
  const pool = PoolNode.parse({
    ...settings,
    ...placement,
    ...(outlineControlPoints ? { outlineControlPoints } : {}),
    name: `Swimming Pool ${poolCount + 1}`,
    parentId: levelId,
    polygon,
    position,
    supportSlabId,
  })
  createPoolPluginNode(pool, levelId)
  const nearbyPool = getPoolNodes(scene.nodes)
    .find((candidate) => candidate.id !== pool.id && findSharedPoolJoint(candidate, pool))
  if (nearbyPool) {
    const joint = findSharedPoolJoint(nearbyPool, pool)
    if (joint) {
      const jointId = `pool-shared-joint_${[nearbyPool.id, pool.id].sort().join('_')}`
      const exists = Object.values(scene.nodes).some((node) => node.id === jointId)
      if (!exists) {
        const sharedJoint = PoolSharedJointNode.parse({
          id: jointId,
          name: `Shared Pool Joint ${nearbyPool.id} / ${pool.id}`,
          parentId: levelId,
          poolIds: [nearbyPool.id, pool.id],
          ...joint,
        })
        createPoolPluginNode(sharedJoint, levelId)
      }
    }
  }
  triggerSFX('sfx:structure-build')
  return pool.id
}

export default function PoolTool() {
  const cursorRef = useRef<Group>(null)
  const mainLine = useMemo(() => {
    const line = new Line(new BufferGeometry(), new LineBasicNodeMaterial({
      color: '#0284c7',
      depthTest: false,
      depthWrite: false,
      linewidth: 3,
    }))
    line.frustumCulled = false
    line.layers.set(EDITOR_LAYER)
    line.renderOrder = 1
    line.visible = false
    return line
  }, [])
  const closingLine = useMemo(() => {
    const line = new Line(new BufferGeometry(), new LineBasicNodeMaterial({
      color: '#0284c7',
      depthTest: false,
      depthWrite: false,
      linewidth: 2,
      opacity: 0.5,
      transparent: true,
    }))
    line.frustumCulled = false
    line.layers.set(EDITOR_LAYER)
    line.renderOrder = 1
    line.visible = false
    return line
  }, [])
  const currentLevelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  const camera = useThree((state) => state.camera)
  const cameraRef = useRef(camera)
  cameraRef.current = camera
  const shape = usePoolStore((state) => state.shape)
  const length = usePoolStore((state) => state.length)
  const width = usePoolStore((state) => state.width)
  const isCustom = shape === 'custom'
  const isSpline = shape === 'spline'
  const isDrawnShape = isDrawnPoolShape(shape)

  const [points, setPoints] = useState<Point[]>([])
  const [cursorPosition, setCursorPosition] = useState<Point>([0, 0])
  const [snappedCursorPosition, setSnappedCursorPosition] = useState<Point>([0, 0])
  const [levelY, setLevelY] = useState(0)
  const levelYRef = useRef(0)
  const pointsRef = useRef<Point[]>([])
  const latestFreehandPointRef = useRef<Point | null>(null)
  const latestGridEventRef = useRef<GridEvent | null>(null)
  const isFreehandDrawingRef = useRef(false)
  const pendingFreehandSelectionReturnRef = useRef(false)
  const previousSnappedPointRef = useRef<Point | null>(null)
  const constructionPlaneRef = useRef<HorizontalConstructionPlane | null>(null)
  const previousShapeRef = useRef(shape)
  const presetPoints = useMemo(() => {
    if (isDrawnShape) return []
    return createPoolShapePolygon(shape, length, width).map(([x, z]): Point => [
      x + snappedCursorPosition[0],
      z + snappedCursorPosition[1],
    ])
  }, [isDrawnShape, length, shape, snappedCursorPosition, width])
  const floorplanDraftPoints = useMemo(() => points, [points])

  useEffect(() => {
    if (previousShapeRef.current === shape) return
    previousShapeRef.current = shape
    setPoints([])
    pointsRef.current = []
    isFreehandDrawingRef.current = false
    pendingFreehandSelectionReturnRef.current = false
    constructionPlaneRef.current = null
    previousSnappedPointRef.current = null
    clearSlabSnapFeedback()
    clearPlacementSurface()
  }, [shape])

  useEffect(
    () => () => {
      clearSlabSnapFeedback()
      clearPlacementSurface()
    },
    [],
  )

  useEffect(() => {
    useEditor.getState().setDraftVertexCount(isDrawnShape ? points.length : 0)
  }, [isDrawnShape, points.length])
  useEffect(() => () => useEditor.getState().setDraftVertexCount(0), [])

  useEffect(() => {
    useFloorplanDraftPreview.getState().setPolygonDraft(
      'slab',
      isDrawnShape ? floorplanDraftPoints : presetPoints,
    )
  }, [floorplanDraftPoints, isDrawnShape, presetPoints])
  useEffect(
    () => () => {
      const draftPreview = useFloorplanDraftPreview.getState()
      if (draftPreview.polygonDraftType === 'slab') {
        draftPreview.setPolygonDraft(null, [])
      }
      draftPreview.setCursorPoint(null)
    },
    [],
  )

  useEffect(() => {
    if (!currentLevelId) return

    const pointedSurfaceFor = (event: GridEvent) =>
      event.nativeEvent?.target instanceof HTMLCanvasElement
        ? resolvePointerSupportSurface(cameraRef.current, event.position)
        : null

    const setDraftPoints = (nextPoints: Point[]) => {
      pointsRef.current = nextPoints
      setPoints(nextPoints)
    }
    const resetDraft = () => {
      setDraftPoints([])
      isFreehandDrawingRef.current = false
      pendingFreehandSelectionReturnRef.current = false
      constructionPlaneRef.current = null
      previousSnappedPointRef.current = null
      clearSlabSnapFeedback()
      clearPlacementSurface()
    }
    const returnToSelection = () => {
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
    }
    const commitFreehandStroke = (rawPoints: Point[], deferSelectionReturn = false) => {
      const outline = buildFreehandPoolOutline(rawPoints, {
        closeDistance: FREEHAND_CLOSE_DISTANCE,
        simplifyTolerance: FREEHAND_SIMPLIFY_TOLERANCE,
      })
      if (!outline) return false
      const dimensions = getPoolPolygonDimensions(outline.polygon)
      const poolId = commitPoolDrawing(
        currentLevelId,
        outline.polygon,
        constructionPlaneRef.current,
        levelYRef.current,
        { shape: 'spline', ...dimensions, outlineControlPoints: outline.anchors },
      )
      setSelection({ selectedIds: [poolId] })
      resetDraft()
      if (deferSelectionReturn) pendingFreehandSelectionReturnRef.current = true
      else returnToSelection()
      return true
    }

    const onGridMove = (event: GridEvent) => {
      if (!cursorRef.current) return
      latestGridEventRef.current = event
      const activePoints = pointsRef.current
      const pointed = !isDrawnShape || activePoints.length === 0 ? pointedSurfaceFor(event) : null
      const plane = constructionPlaneRef.current
      if (plane) {
        publishHorizontalConstructionPlane(event, plane)
      } else if (pointed) {
        publishPlacementSurface(
          surfacePointScratch.set(event.position[0], pointed.worldY, event.position[2]),
          SURFACE_UP,
        )
      }

      const localPosition = worldPointToPoolLevel(
        sceneRegistry.nodes.get(currentLevelId as never),
        pointed?.worldPoint ?? event.position,
      )
      const rawPoint: Point = [localPosition[0], localPosition[2]]
      latestFreehandPointRef.current = rawPoint
      const gridStep = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const gridPosition: Point = [...snapPointToGrid(rawPoint, gridStep)]
      setCursorPosition(gridPosition)
      const lastPoint = isDrawnShape ? activePoints.at(-1) : undefined
      const anglePoint: Point = isCustom && isAngleSnapActive() && lastPoint
        ? [...snapPointAlongAngleRay(lastPoint, rawPoint, DEFAULT_ANGLE_STEP, gridStep)]
        : gridPosition
      const displayPoint = isSpline
        ? rawPoint
        : resolveSlabPlanPointSnap({
            rawPoint,
            fallbackPoint: anglePoint,
            levelId: currentLevelId,
          }).point
      const hoverPlane = plane ?? resampleTerrainConstructionPlane(
        resolveEventConstructionPlane(event, pointed),
        displayPoint,
      )
      levelYRef.current = localPosition[1]
      setLevelY(localPosition[1])
      useFloorplanDraftPreview.getState().setCursorPoint(displayPoint)
      setSnappedCursorPosition(displayPoint)
      if (
        !isSpline &&
        activePoints.length > 0 &&
        previousSnappedPointRef.current &&
        (displayPoint[0] !== previousSnappedPointRef.current[0] ||
          displayPoint[1] !== previousSnappedPointRef.current[1])
      ) {
        triggerSFX('sfx:grid-snap')
      }
      previousSnappedPointRef.current = displayPoint
      cursorRef.current.position.set(displayPoint[0], hoverPlane.localY, displayPoint[1])

      if (isSpline && isFreehandDrawingRef.current) {
        const advanced = advanceFreehandPoolStroke(activePoints, rawPoint, {
          closeDistance: FREEHAND_CLOSE_DISTANCE,
          sampleDistance: FREEHAND_SAMPLE_DISTANCE,
        })
        if (advanced.points.length !== activePoints.length) setDraftPoints(advanced.points)
        if (advanced.closed) {
          isFreehandDrawingRef.current = false
          const committed = commitFreehandStroke([...advanced.closed, advanced.closed[0]!], true)
          if (!committed) resetDraft()
          // The close can be detected during pointer movement, before the
          // browser emits pointerup. Keep that event owned by the drawing
          // tool so selection cannot start dragging the newly created pool.
          pendingFreehandSelectionReturnRef.current = true
        }
      }
    }

    const finishCustomDrawing = () => {
      const activePoints = pointsRef.current
      if (!isCustom || activePoints.length < 3 || !isPoolPolygonPlaceable(activePoints)) return
      const dimensions = getPoolPolygonDimensions(activePoints)
      const poolId = commitPoolDrawing(
        currentLevelId,
        activePoints,
        constructionPlaneRef.current,
        levelYRef.current,
        { shape, ...dimensions },
      )
      setSelection({ selectedIds: [poolId] })
      resetDraft()
      returnToSelection()
    }

    const onGridClick = (event: GridEvent) => {
      if (isSpline) return
      const clickPoint = previousSnappedPointRef.current ?? cursorPosition
      if (!isDrawnShape) {
        const plane = resampleTerrainConstructionPlane(
          resolveEventConstructionPlane(event, pointedSurfaceFor(event)),
          clickPoint,
        )
        const translated = createPoolShapePolygon(shape, length, width).map(
          ([x, z]): Point => [x + clickPoint[0], z + clickPoint[1]],
        )
        triggerSFX('sfx:structure-build-start')
        const poolId = commitPoolDrawing(
          currentLevelId,
          translated,
          plane,
          levelYRef.current,
          { shape, length, width },
        )
        setSelection({ selectedIds: [poolId] })
        resetDraft()
        returnToSelection()
        return
      }
      const activePoints = pointsRef.current
      const firstPoint = activePoints[0]
      if (
        activePoints.length >= 3 &&
        firstPoint &&
        Math.abs(clickPoint[0] - firstPoint[0]) < FREEHAND_CLOSE_DISTANCE &&
        Math.abs(clickPoint[1] - firstPoint[1]) < FREEHAND_CLOSE_DISTANCE
      ) {
        finishCustomDrawing()
        return
      }
      if (activePoints.length === 0) {
        const plane = resampleTerrainConstructionPlane(
          resolveEventConstructionPlane(event, pointedSurfaceFor(event)),
          clickPoint,
        )
        constructionPlaneRef.current = plane
        const nextLevelY = worldPointToPoolLevel(
          sceneRegistry.nodes.get(currentLevelId as never),
          event.position,
        )[1]
        levelYRef.current = nextLevelY
        setLevelY(nextLevelY)
        publishHorizontalConstructionPlane(event, plane)
      }
      triggerSFX('sfx:structure-build-start')
      setDraftPoints([...activePoints, clickPoint])
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!isSpline || event.button !== 0 || !(event.target instanceof HTMLCanvasElement)) return
      const gridEvent = latestGridEventRef.current
      const startPoint = latestFreehandPointRef.current
      if (!gridEvent || !startPoint) return
      event.preventDefault()
      event.stopPropagation()
      const plane = resampleTerrainConstructionPlane(
        resolveEventConstructionPlane(gridEvent, pointedSurfaceFor(gridEvent)),
        startPoint,
      )
      constructionPlaneRef.current = plane
      const nextLevelY = worldPointToPoolLevel(
        sceneRegistry.nodes.get(currentLevelId as never),
        gridEvent.position,
      )[1]
      levelYRef.current = nextLevelY
      setLevelY(nextLevelY)
      publishHorizontalConstructionPlane(gridEvent, plane)
      isFreehandDrawingRef.current = true
      setDraftPoints([startPoint])
      triggerSFX('sfx:structure-build-start')
    }

    const onPointerUp = (event: PointerEvent) => {
      if (pendingFreehandSelectionReturnRef.current) {
        event.preventDefault()
        event.stopPropagation()
        pendingFreehandSelectionReturnRef.current = false
        returnToSelection()
        return
      }
      if (!isSpline || !isFreehandDrawingRef.current) return
      event.preventDefault()
      event.stopPropagation()
      isFreehandDrawingRef.current = false
      const activePoints = pointsRef.current
      const firstPoint = activePoints[0]
      if (!firstPoint || activePoints.length < 3) {
        resetDraft()
        return
      }
      if (!commitFreehandStroke([...activePoints, firstPoint])) resetDraft()
    }

    const onCancel = () => {
      if (pointsRef.current.length > 0) markToolCancelConsumed()
      resetDraft()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      finishCustomDrawing()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointerup', onPointerUp, true)
    emitter.on('grid:move', onGridMove)
    emitter.on('grid:click', onGridClick)
    emitter.on('grid:double-click', finishCustomDrawing)
    emitter.on('tool:cancel', onCancel)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      emitter.off('grid:move', onGridMove)
      emitter.off('grid:click', onGridClick)
      emitter.off('grid:double-click', finishCustomDrawing)
      emitter.off('tool:cancel', onCancel)
    }
  }, [currentLevelId, cursorPosition, isCustom, isDrawnShape, isSpline, length, setSelection, shape, width])

  useEffect(() => {
    if (!isDrawnShape || points.length === 0) {
      mainLine.visible = false
      closingLine.visible = false
      return
    }
    const y = levelY + Y_OFFSET
    const draftLine: Point[] = isSpline ? points : [...points, snappedCursorPosition]
    const linePoints = draftLine.map(([x, z]) => new Vector3(x, y, z))
    mainLine.geometry.dispose()
    mainLine.geometry = new BufferGeometry().setFromPoints(linePoints)
    mainLine.visible = true

    const firstPoint = points[0]
    if (!isSpline && points.length >= 2 && firstPoint) {
      closingLine.geometry.dispose()
      closingLine.geometry = new BufferGeometry().setFromPoints([
        new Vector3(snappedCursorPosition[0], y, snappedCursorPosition[1]),
        new Vector3(firstPoint[0], y, firstPoint[1]),
      ])
      closingLine.visible = true
    } else {
      closingLine.visible = false
    }
  }, [closingLine, isDrawnShape, isSpline, levelY, mainLine, points, snappedCursorPosition])

  useEffect(() => () => {
    mainLine.geometry.dispose()
    mainLine.material.dispose()
    closingLine.geometry.dispose()
    closingLine.material.dispose()
  }, [closingLine, mainLine])

  const previewShape = useMemo(() => {
    if (isSpline) return null
    const anchors = isDrawnShape ? [...points, snappedCursorPosition] : presetPoints
    if ((isDrawnShape && points.length < 2) || anchors.length < 3) return null
    const first = anchors[0]
    if (!first) return null
    const shape = new Shape()
    shape.moveTo(first[0], -first[1])
    for (const [x, z] of anchors.slice(1)) shape.lineTo(x, -z)
    shape.closePath()
    return shape
  }, [isDrawnShape, isSpline, points, presetPoints, snappedCursorPosition])

  return (
    <PoolLevelPreviewGroup>
    <group>
      <CursorSphere color="#0284c7" ref={cursorRef} />
      {previewShape && (
        <mesh
          frustumCulled={false}
          layers={EDITOR_LAYER}
          position={[0, levelY + Y_OFFSET, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <shapeGeometry args={[previewShape]} />
          <meshBasicMaterial
            color="#38bdf8"
            depthTest={false}
            opacity={0.2}
            side={DoubleSide}
            transparent
          />
        </mesh>
      )}
      <primitive object={mainLine} />
      <primitive object={closingLine} />
      {points.map(([x, z], index) => (!isSpline || index === 0) && (
        <CursorSphere
          color="#0284c7"
          height={0}
          key={`${x}-${z}-${index}`}
          position={[x, levelY + Y_OFFSET + 0.01, z]}
          showTooltip={false}
        />
      ))}
    </group>
    </PoolLevelPreviewGroup>
  )
}
