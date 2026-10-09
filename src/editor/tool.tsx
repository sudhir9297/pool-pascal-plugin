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
import { alignPoolCopingToSurface } from '../design/coping-rise'
import { isPlacementRotationKey, rotatePlanPoint } from './placement-rotation'
import {
  createPoolShapePolygon,
  getPoolPolygonDimensions,
  isDrawnPoolShape,
  isPoolPolygonPlaceable,
  type PoolShape,
} from '../design/shapes'
import { updateDynamicLine } from './dynamic-line'
import { createFrameInput } from './frame-input'
import { usePoolStore } from './store'
import { findSharedPoolJoint } from '../design/shared-joint'
import { PoolSharedJointNode } from '../shared-joint/core/schema'
import { nextSwimmingPoolName, createPoolPluginNode, getPoolNodes } from './scene-nodes'

type Point = [number, number]

const Y_OFFSET = 0.02
const FREEHAND_CLOSE_DISTANCE = 0.25
const FREEHAND_SAMPLE_DISTANCE = 0.03
const FREEHAND_SIMPLIFY_TOLERANCE = 0.04
function drawingSurface(target: EventTarget | null) {
  if (target instanceof HTMLCanvasElement) return target
  if (!(target instanceof Element)) return null
  const svg = target.closest('svg')
  return svg?.querySelector('[data-floorplan-scene]') ? svg : null
}

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
    rotationY?: number
    outlineControlPoints?: Point[]
  },
) {
  const scene = useScene.getState()
  const settings = usePoolStore.getState()
  const { polygon: localizedPolygon, position: localizedPosition } = localizePoolPolygon(points)
  const rotationY = placement.rotationY ?? 0
  // Preset placement currently supplies points already rotated in level space.
  // Store that rotation on the node and keep its polygon in local space so
  // moving the node does not make the editor fall back to the default yaw.
  const polygon = localizedPolygon.map((point): Point => rotatePlanPoint(point, -rotationY))
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
  const draft = PoolNode.parse({
    ...settings,
    ...placement,
    rotation: [0, rotationY, 0],
    ...(outlineControlPoints ? { outlineControlPoints } : {}),
    name: nextSwimmingPoolName(scene.nodes),
    parentId: levelId,
    polygon,
    position,
    supportSlabId,
  })
  // Placement picks the finished slab or ground surface. Recess the shell so
  // the highest coping point meets that surface instead of rising above it.
  const pool = alignPoolCopingToSurface(draft)
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
  const [placementYaw, setPlacementYaw] = useState(0)
  const placementYawRef = useRef(0)
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
  const previousGridPointRef = useRef<Point | null>(null)
  const previousMagneticSnapRef = useRef<string | null>(null)
  const placementCommittedRef = useRef(false)
  const constructionPlaneRef = useRef<HorizontalConstructionPlane | null>(null)
  const freehandPointerIdRef = useRef<number | null>(null)
  const previousShapeRef = useRef(shape)
  const presetLocalPoints = useMemo(() => isDrawnShape ? [] : createPoolShapePolygon(shape, length, width), [isDrawnShape, shape, length, width])
  const presetPoints = useMemo(() => {
    if (isDrawnShape) return []
    return presetLocalPoints.map(point => rotatePlanPoint(point, placementYaw)).map(([x, z]): Point => [
      x + snappedCursorPosition[0],
      z + snappedCursorPosition[1],
    ])
  }, [isDrawnShape, presetLocalPoints, snappedCursorPosition, placementYaw])
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
    previousGridPointRef.current = null
    previousMagneticSnapRef.current = null
    placementCommittedRef.current = false
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
        ? resolvePointerSupportSurface(cameraRef.current, event.position, { includeNodeTopSurfaces: true })
        : null

    const setDraftPoints = (nextPoints: Point[]) => {
      pointsRef.current = nextPoints
      setPoints(nextPoints)
    }
    const resetDraft = () => {
      setDraftPoints([])
      isFreehandDrawingRef.current = false
      freehandPointerIdRef.current = null
      pendingFreehandSelectionReturnRef.current = false
      constructionPlaneRef.current = null
      previousSnappedPointRef.current = null
      previousGridPointRef.current = null
      previousMagneticSnapRef.current = null
      clearSlabSnapFeedback()
      clearPlacementSurface()
    }
    const returnToSelection = () => {
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
    }
    const commitFreehandStroke = (rawPoints: Point[], deferSelectionReturn = false) => {
      if (placementCommittedRef.current) return false
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
      placementCommittedRef.current = true
      setSelection({ selectedIds: [poolId] })
      const pointerId = freehandPointerIdRef.current
      resetDraft()
      if (deferSelectionReturn) {
        freehandPointerIdRef.current = pointerId
        pendingFreehandSelectionReturnRef.current = true
      }
      else returnToSelection()
      return true
    }

    const onGridMove = (event: GridEvent) => {
      if (!cursorRef.current || placementCommittedRef.current) return
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
      const surfaceSnap = isSpline ? null : resolveSlabPlanPointSnap({
        rawPoint,
        fallbackPoint: anglePoint,
        levelId: currentLevelId,
      })
      const displayPoint = surfaceSnap?.point ?? rawPoint
      const hoverPlane = plane ?? resampleTerrainConstructionPlane(
        resolveEventConstructionPlane(event, pointed),
        displayPoint,
      )
      levelYRef.current = hoverPlane.elevation ?? localPosition[1]
      setLevelY(levelYRef.current)
      useFloorplanDraftPreview.getState().setCursorPoint(displayPoint)
      setSnappedCursorPosition(displayPoint)
      const magneticSnap = surfaceSnap && (surfaceSnap.wallSnap || surfaceSnap.guides?.length)
        ? JSON.stringify([surfaceSnap.wallSnap, surfaceSnap.wallIds,
            surfaceSnap.guides?.map((guide) => [guide.axis, guide.coord, guide.candidateNodeId])])
        : null
      const gridChanged = gridStep > 0 && previousGridPointRef.current &&
        (gridPosition[0] !== previousGridPointRef.current[0] || gridPosition[1] !== previousGridPointRef.current[1])
      if (!isSpline && (gridChanged || (magneticSnap && magneticSnap !== previousMagneticSnapRef.current))) {
        triggerSFX('sfx:grid-snap')
      }
      previousGridPointRef.current = gridStep > 0 ? gridPosition : null
      previousMagneticSnapRef.current = magneticSnap
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

    const frameInput = createFrameInput(onGridMove, () => isSpline && isFreehandDrawingRef.current)

    const finishCustomDrawing = () => {
      if (placementCommittedRef.current) return
      frameInput.flush()
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
      placementCommittedRef.current = true
      setSelection({ selectedIds: [poolId] })
      resetDraft()
      returnToSelection()
    }

    const onGridClick = (event: GridEvent) => {
      if (placementCommittedRef.current) return
      frameInput.flush()
      if (isSpline) return
      const clickPoint = previousSnappedPointRef.current ?? cursorPosition
      if (!isDrawnShape) {
        const plane = resampleTerrainConstructionPlane(
          resolveEventConstructionPlane(event, pointedSurfaceFor(event)),
          clickPoint,
        )
        const translated = presetLocalPoints.map(point => rotatePlanPoint(point, placementYawRef.current)).map(
          ([x, z]): Point => [x + clickPoint[0], z + clickPoint[1]],
        )
        const poolId = commitPoolDrawing(
          currentLevelId,
          translated,
          plane,
          plane.elevation ?? levelYRef.current,
          { shape, length, width, rotationY: placementYawRef.current },
        )
        placementCommittedRef.current = true
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
        const nextLevelY = plane.elevation ?? worldPointToPoolLevel(
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
      frameInput.flush()
      const surface = drawingSurface(event.target)
      if (!isSpline || event.button !== 0 || !surface) return
      const gridEvent = latestGridEventRef.current
      let startPoint = latestFreehandPointRef.current
      if (surface instanceof SVGSVGElement) {
        const matrix = surface.querySelector<SVGGraphicsElement>('[data-floorplan-scene]')?.getScreenCTM()
        if (!matrix) return
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
        startPoint = [point.x, point.y]
      }
      if (!gridEvent || !startPoint) return
      event.preventDefault()
      if (surface instanceof HTMLCanvasElement) event.stopPropagation()
      freehandPointerIdRef.current = event.pointerId
      const plane = resampleTerrainConstructionPlane(
        resolveEventConstructionPlane(gridEvent, pointedSurfaceFor(gridEvent)),
        startPoint,
      )
      constructionPlaneRef.current = plane
      const nextLevelY = plane.elevation ?? worldPointToPoolLevel(
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
      frameInput.flush()
      if (freehandPointerIdRef.current !== event.pointerId) return
      freehandPointerIdRef.current = null
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

    const onPointerCancel = (event: PointerEvent) => {
      frameInput.dispose()
      if (freehandPointerIdRef.current === event.pointerId) resetDraft()
    }
    const onCancel = () => {
      frameInput.dispose()
      if (pointsRef.current.length > 0) markToolCancelConsumed()
      resetDraft()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return
      if (event.key === 'Backspace' && isCustom && pointsRef.current.length > 0) {
        event.preventDefault()
        setDraftPoints(pointsRef.current.slice(0, -1))
        return
      }
      if (isPlacementRotationKey(event)) {
        event.preventDefault()
        event.stopPropagation()
        if (isDrawnShape) {
          const anchor = pointsRef.current[0]
          if (anchor) setDraftPoints(pointsRef.current.map(([x, z]) => {
            const rotated = rotatePlanPoint([x - anchor[0], z - anchor[1]], Math.PI / 2)
            return [rotated[0] + anchor[0], rotated[1] + anchor[1]]
          }))
        } else {
          placementYawRef.current = (placementYawRef.current + Math.PI / 2) % (Math.PI * 2)
          setPlacementYaw(placementYawRef.current)
        }
        return
      }
      if (event.key !== 'Enter') return
      event.preventDefault()
      finishCustomDrawing()
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('pointercancel', onPointerCancel, true)
    emitter.on('grid:move', frameInput.push)
    emitter.on('grid:click', onGridClick)
    emitter.on('grid:double-click', finishCustomDrawing)
    emitter.on('tool:cancel', onCancel)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('pointercancel', onPointerCancel, true)
      frameInput.dispose()
      emitter.off('grid:move', frameInput.push)
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
    updateDynamicLine(mainLine.geometry, linePoints)
    mainLine.frustumCulled = false
    mainLine.visible = true

    const firstPoint = points[0]
    if (!isSpline && points.length >= 2 && firstPoint) {
      closingLine.frustumCulled = false
      updateDynamicLine(closingLine.geometry, [
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
    const anchors = isDrawnShape ? [...points, snappedCursorPosition] : presetLocalPoints
    if ((isDrawnShape && points.length < 2) || anchors.length < 3) return null
    const first = anchors[0]
    if (!first) return null
    const shape = new Shape()
    shape.moveTo(first[0], -first[1])
    for (const [x, z] of anchors.slice(1)) shape.lineTo(x, -z)
    shape.closePath()
    return shape
  }, [isDrawnShape, isSpline, points, presetLocalPoints, isDrawnShape ? snappedCursorPosition : null])

  return (
    <PoolLevelPreviewGroup>
    <group>
      <CursorSphere color="#0284c7" ref={cursorRef} />
      {previewShape && (
        <mesh
          frustumCulled={false}
          layers={EDITOR_LAYER}
          position={[isDrawnShape ? 0 : snappedCursorPosition[0], levelY + Y_OFFSET, isDrawnShape ? 0 : snappedCursorPosition[1]]}
          rotation={[-Math.PI / 2, 0, isDrawnShape ? 0 : -placementYaw]}
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
