import type { HandleDescriptor } from '@pascal-app/core'
import { Euler, Vector3 } from 'three'
import { getPoolDepthRange } from '../design/depth-profile'
import { poolParametrics } from '../editor/parametrics'
import { PoolNode, resolvePoolPolygon } from './schema'
import { createPoolShapePolygon, getPoolPolygonDimensions, isDrawnPoolShape } from '../design/shapes'
import { poolOutlineAffordances } from '../editor/outline-affordances'
import type { PoolEditContribution } from '../definition-compose'

const SIDE_HANDLE_OFFSET = 0.35
const HANDLE_HEIGHT_OFFSET = 0.18
const DEPTH_HANDLE_FLOOR_CLEARANCE = 0.25
const MIN_POOL_DIMENSION = 0.5
const MAX_POOL_DIMENSION = 100
const MAX_POOL_DEPTH = 4
const ROTATE_HANDLE_OFFSET = 0.42
const ROTATE_RING_OFFSET = 0.06
const FEATURE_HANDLE_OFFSET = 0.28

function finiteOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function poolHandleDeckElevation(node: PoolNode) {
  return finiteOr(node.finishedDeckElevation, 0)
}

function poolHandleCopingThickness(node: PoolNode) {
  return finiteOr(node.copingThickness, 0.08)
}

function poolHandleCopingWidth(node: PoolNode) {
  return finiteOr(node.copingWidth, 0.3)
}

function resizePoolOutline(
  node: PoolNode,
  length: number,
  width: number,
): Pick<PoolNode, 'outlineControlPoints' | 'outlineTangents' | 'polygon'> {
  if (!isDrawnPoolShape(node.shape)) {
    return {
      outlineControlPoints: [],
      outlineTangents: [],
      polygon: createPoolShapePolygon(node.shape, length, width),
    }
  }

  const polygon = resolvePoolPolygon(node)
  const xs = polygon.map(([x]) => x)
  const zs = polygon.map(([, z]) => z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  const scaleX = length / Math.max(maxX - minX, Number.EPSILON)
  const scaleZ = width / Math.max(maxZ - minZ, Number.EPSILON)
  const scale = (points: ReadonlyArray<readonly [number, number]>) => points.map(
    ([x, z]): [number, number] => [
      centerX + (x - centerX) * scaleX,
      centerZ + (z - centerZ) * scaleZ,
    ],
  )
  return {
    outlineControlPoints: scale(node.outlineControlPoints),
    outlineTangents: node.outlineTangents.map((tangent) => ({
      incoming: scale([tangent.incoming])[0]!, outgoing: scale([tangent.outgoing])[0]!,
    })),
    polygon: scale(polygon),
  }
}

function poolHorizontalHandle(axis: 'x' | 'z'): HandleDescriptor<PoolNode> {
  return {
    kind: 'linear-resize',
    axis,
    anchor: 'min',
    gridSnap: true,
    min: MIN_POOL_DIMENSION,
    max: MAX_POOL_DIMENSION,
    currentValue: (node) => {
      const dimensions = isDrawnPoolShape(node.shape)
        ? getPoolPolygonDimensions(resolvePoolPolygon(node))
        : node
      return axis === 'x' || node.shape === 'circle' ? dimensions.length : dimensions.width
    },
    apply: (node, newValue) => {
      const dimensions = isDrawnPoolShape(node.shape)
        ? getPoolPolygonDimensions(resolvePoolPolygon(node))
        : node
      const length = axis === 'x' || node.shape === 'circle' ? newValue : dimensions.length
      const width = node.shape === 'circle' ? newValue : axis === 'z' ? newValue : dimensions.width
      // Outlines resize around their local centre. Move that centre by half
      // the size change so the opposite edge stays fixed in the parent frame.
      const offset = new Vector3(
        axis === 'x' ? (length - dimensions.length) / 2 : 0,
        0,
        axis === 'z' ? (width - (node.shape === 'circle' ? dimensions.length : dimensions.width)) / 2 : 0,
      ).applyEuler(new Euler(...node.rotation))
      return {
        length,
        width,
        position: new Vector3(...node.position).add(offset).toArray(),
        ...resizePoolOutline(node, length, width),
      }
    },
    placement: {
      position: (node) => {
        const dimensions = isDrawnPoolShape(node.shape)
          ? getPoolPolygonDimensions(resolvePoolPolygon(node))
          : node
        return axis === 'x'
          ? [
              dimensions.length / 2 + poolHandleCopingWidth(node) + SIDE_HANDLE_OFFSET,
              poolHandleDeckElevation(node)
                + poolHandleCopingThickness(node)
                + HANDLE_HEIGHT_OFFSET,
              0,
            ]
          : [
              0,
              poolHandleDeckElevation(node)
                + poolHandleCopingThickness(node)
                + HANDLE_HEIGHT_OFFSET,
              (node.shape === 'circle' ? dimensions.length : dimensions.width) / 2 + poolHandleCopingWidth(node) + SIDE_HANDLE_OFFSET,
            ]
      },
    },
  }
}

function poolCircleDiameterHandle(): HandleDescriptor<PoolNode> {
  return {
    kind: 'radial-resize',
    axis: 'x',
    min: MIN_POOL_DIMENSION,
    max: MAX_POOL_DIMENSION,
    currentValue: (node) => getPoolPolygonDimensions(resolvePoolPolygon(node)).length,
    apply: (node, newValue) => ({
      length: newValue,
      width: newValue,
      ...resizePoolOutline(node, newValue, newValue),
    }),
    placement: {
      position: (node) => {
        const dimensions = getPoolPolygonDimensions(resolvePoolPolygon(node))
        return [
          dimensions.length / 2 + poolHandleCopingWidth(node) + SIDE_HANDLE_OFFSET,
          poolHandleDeckElevation(node) + poolHandleCopingThickness(node) + HANDLE_HEIGHT_OFFSET,
          0,
        ]
      },
    },
    decoration: {
      kind: 'ring',
      radius: (node) => getPoolPolygonDimensions(resolvePoolPolygon(node)).length / 2 + ROTATE_RING_OFFSET,
      y: (node) => poolHandleDeckElevation(node) + poolHandleCopingThickness(node),
    },
  }
}

function poolDepthHandle(): HandleDescriptor<PoolNode> {
  return {
    kind: 'linear-resize',
    axis: 'y',
    // The deck is fixed while the basin floor follows a downward drag.
    anchor: 'max',
    min: MIN_POOL_DIMENSION,
    max: MAX_POOL_DEPTH,
    currentValue: (node) => getPoolDepthRange(node).maximum,
    apply: (node, newValue) => node.floorProfile === 'flat'
      ? { depth: newValue }
      : {
          deepDepth: newValue,
          shallowDepth: Math.min(node.shallowDepth, newValue),
        },
    placement: {
      position: (node) => [
        0,
        poolHandleDeckElevation(node)
          - getPoolDepthRange(node).maximum
          + DEPTH_HANDLE_FLOOR_CLEARANCE,
        0,
      ],
    },
  }
}

function poolShallowDepthHandle(): HandleDescriptor<PoolNode> {
  return {
    kind: 'linear-resize',
    axis: 'y',
    anchor: 'max',
    min: MIN_POOL_DIMENSION,
    max: MAX_POOL_DEPTH,
    currentValue: (node) => node.shallowDepth,
    apply: (node, newValue) => ({
      shallowDepth: Math.min(newValue, node.deepDepth),
    }),
    visible: (node) => node.floorProfile === 'shallow-to-deep',
    placement: {
      position: (node) => {
        const polygon = resolvePoolPolygon(node)
        const xs = polygon.map(([x]) => x)
        const minimumX = Math.min(...xs)
        const maximumX = Math.max(...xs)
        return [
          minimumX + (maximumX - minimumX) * 0.12,
          poolHandleDeckElevation(node) - node.shallowDepth + DEPTH_HANDLE_FLOOR_CLEARANCE,
          0,
        ]
      },
    },
  }
}

function poolRotateHandle(): HandleDescriptor<PoolNode> {
  return {
    kind: 'arc-resize',
    axis: 'angular',
    shape: 'rotate',
    // The editor's standard 15° snap applies by default. Holding Shift
    // temporarily bypasses it for free, smooth positioning.
    apply: (initial, delta) => {
      const [rx, ry, rz] = initial.rotation
      return { rotation: [rx, ry - delta, rz] }
    },
    placement: {
      position: (node) => {
        const dimensions = isDrawnPoolShape(node.shape)
          ? getPoolPolygonDimensions(resolvePoolPolygon(node))
          : node
        return [
          dimensions.length / 2 + poolHandleCopingWidth(node) + ROTATE_HANDLE_OFFSET,
          poolHandleDeckElevation(node) + poolHandleCopingThickness(node) + HANDLE_HEIGHT_OFFSET,
          (node.shape === 'circle' ? dimensions.length : dimensions.width) / 2
            + poolHandleCopingWidth(node) + ROTATE_HANDLE_OFFSET,
        ]
      },
      rotationY: () => -Math.PI / 4,
    },
    decoration: {
      kind: 'ring',
      radius: (node) => {
        const dimensions = isDrawnPoolShape(node.shape)
          ? getPoolPolygonDimensions(resolvePoolPolygon(node))
          : node
        const halfWidth = node.shape === 'circle' ? dimensions.length / 2 : dimensions.width / 2
        return Math.hypot(
          dimensions.length / 2 + poolHandleCopingWidth(node) + ROTATE_HANDLE_OFFSET,
          halfWidth + poolHandleCopingWidth(node) + ROTATE_HANDLE_OFFSET,
        )
      },
      y: (node) => poolHandleDeckElevation(node) + poolHandleCopingThickness(node),
    },
  }
}

function poolEntryLengthHandle(): HandleDescriptor<PoolNode> {
  return {
    kind: 'linear-resize',
    axis: 'x',
    anchor: 'min',
    min: 0.5,
    max: (node) => {
      const polygon = resolvePoolPolygon(node)
      const xs = polygon.map(([x]) => x)
      return Math.min(MAX_POOL_DIMENSION, (Math.max(...xs) - Math.min(...xs)) * 0.6)
    },
    currentValue: (node) => node.entryLength,
    apply: (_node, newValue) => ({ entryLength: newValue }),
    visible: (node) => node.entryFeature !== 'none',
    placement: {
      position: (node) => {
        const polygon = resolvePoolPolygon(node)
        const minimumX = Math.min(...polygon.map(([x]) => x))
        return [
          minimumX + node.entryLength + FEATURE_HANDLE_OFFSET,
          poolHandleDeckElevation(node) + poolHandleCopingThickness(node) + HANDLE_HEIGHT_OFFSET,
          0,
        ]
      },
    },
  }
}

function poolBenchBoundaryT(node: PoolNode, polygon: [number, number][]) {
  if (Object.prototype.hasOwnProperty.call(node, 'benchBoundaryT')) return node.benchBoundaryT
  const perimeter = polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length]!
    return sum + Math.hypot(next[0] - point[0], next[1] - point[1])
  }, 0)
  let distance = 0
  let bestT = 0
  let bestScore = Number.POSITIVE_INFINITY
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!
    const end = polygon[(index + 1) % polygon.length]!
    const edgeLength = Math.hypot(end[0] - start[0], end[1] - start[1])
    const midpoint: [number, number] = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
    const score = node.benchWall === 'min-x' ? midpoint[0]
      : node.benchWall === 'max-x' ? -midpoint[0]
        : node.benchWall === 'min-z' ? midpoint[1]
          : -midpoint[1]
    if (score < bestScore) { bestScore = score; bestT = (distance + edgeLength / 2) / perimeter }
    distance += edgeLength
  }
  return bestT
}

function poolBenchFrontPosition(node: PoolNode) {
  const polygon = resolvePoolPolygon(node)
  const lengths = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]!
    return Math.hypot(next[0] - point[0], next[1] - point[1])
  })
  const perimeter = lengths.reduce((sum, length) => sum + length, 0)
  const area = polygon.reduce((sum, [x, z], index) => {
    const next = polygon[(index + 1) % polygon.length]!
    return sum + x * next[1] - next[0] * z
  }, 0) / 2
  let remaining = perimeter * poolBenchBoundaryT(node, polygon)
  for (let index = 0; index < polygon.length; index += 1) {
    const edgeLength = lengths[index]!
    if (remaining <= edgeLength || index === polygon.length - 1) {
      const start = polygon[index]!
      const end = polygon[(index + 1) % polygon.length]!
      const tangentX = (end[0] - start[0]) / Math.max(edgeLength, 0.001)
      const tangentZ = (end[1] - start[1]) / Math.max(edgeLength, 0.001)
      const progress = edgeLength <= 0.001 ? 0 : remaining / edgeLength
      const boundaryX = start[0] + (end[0] - start[0]) * progress
      const boundaryZ = start[1] + (end[1] - start[1]) * progress
      const inwardX = area >= 0 ? -tangentZ : tangentZ
      const inwardZ = area >= 0 ? tangentX : -tangentX
      const frontDistance = node.benchWidth + FEATURE_HANDLE_OFFSET
      return {
        point: [boundaryX + inwardX * frontDistance, boundaryZ + inwardZ * frontDistance] as [number, number],
        tangent: [tangentX, tangentZ] as [number, number],
        inward: [inwardX, inwardZ] as [number, number],
      }
    }
    remaining -= edgeLength
  }
  return { point: polygon[0]!, tangent: [1, 0] as [number, number], inward: [0, 1] as [number, number] }
}

function poolBenchHandle(
  dimension: 'length' | 'width',
  axis: 'x' | 'z',
  increasingDirection: number,
): HandleDescriptor<PoolNode> {
  return {
    kind: 'linear-resize',
    axis,
    // The editor's `max` anchor reverses the drag delta. This keeps a bench
    // growing in the direction it faces when that direction is local -X/-Z.
    anchor: increasingDirection >= 0 ? 'center' : 'max',
    min: dimension === 'length' ? 0.5 : 0.2,
    max: dimension === 'length' ? 20 : 1.5,
    currentValue: (node) => dimension === 'length' ? node.benchLength : node.benchWidth,
    apply: (_node, newValue) => dimension === 'length' ? { benchLength: newValue } : { benchWidth: newValue },
    visible: (node) => node.benchEnabled && (dimension === 'width' || node.benchStyle === 'end'),
    placement: {
      position: (node) => {
        const front = poolBenchFrontPosition(node)
        const tangentDistance = dimension === 'length' ? node.benchLength / 2 + FEATURE_HANDLE_OFFSET : 0
        return [
          front.point[0] + front.tangent[0] * tangentDistance,
          -node.benchWaterDepth,
          front.point[1] + front.tangent[1] * tangentDistance,
        ]
      },
      rotationY: (node) => {
        const front = poolBenchFrontPosition(node)
        const direction = dimension === 'length' ? front.tangent : front.inward
        const axisRotation = axis === 'z' ? -Math.PI / 2 : 0
        return Math.atan2(-direction[1], direction[0]) - axisRotation
      },
    },
  }
}

function poolHandles(node: PoolNode): HandleDescriptor<PoolNode>[] {
  const dimensions = node.shape === 'circle'
    ? [poolCircleDiameterHandle()]
    : [poolHorizontalHandle('x'), poolHorizontalHandle('z')]
  return [
    ...dimensions,
    poolDepthHandle(),
    poolShallowDepthHandle(),
    poolRotateHandle(),
    poolEntryLengthHandle(),
    ...(() => {
      const front = poolBenchFrontPosition(node)
      const tangentAxis = Math.abs(front.tangent[0]) >= Math.abs(front.tangent[1]) ? 'x' : 'z'
      const normalAxis = tangentAxis === 'x' ? 'z' : 'x'
      const tangentDirection = tangentAxis === 'x' ? front.tangent[0] : front.tangent[1]
      const normalDirection = normalAxis === 'x' ? front.inward[0] : front.inward[1]
      return [
        poolBenchHandle('length', tangentAxis, tangentDirection),
        poolBenchHandle('width', normalAxis, normalDirection),
      ]
    })(),
  ]
}

/**
 * The pool's edit half: parameters, resize/rotate/feature handles, outline
 * editing in the plan, the editor renderer (outline controls), placement tool
 * and preview.
 */
export const poolEditContribution: PoolEditContribution<typeof PoolNode> = {
  snapProfile: 'item',
  parametrics: poolParametrics,
  handles: poolHandles,
  floorplanAffordances: poolOutlineAffordances,
  renderer: { kind: 'parametric', module: () => import('../editor/renderer.edit') },
  preview: () => import('../editor/preview'),
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Left click / drag', label: 'Place preset, add corner, or sketch freehand' },
    { key: 'Release / Enter', label: 'Finish the drawn pool outline' },
    { key: 'Backspace', label: 'Remove last custom outline point' },
    { key: 'Esc', label: 'Cancel pool drawing' },
  ],
}
