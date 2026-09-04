import { PoolNode, type PoolPoint, resolvePoolPolygon } from '../../core/schema'
import { findSharedPoolJoint } from '../../design/shared-joint'
import type { PoolSpilloverNode } from '../core/schema'

const MAX_CONNECTION_LENGTH = 20
const POOL_OPENING_DEPTH = 0.15

function worldWaterHeight(pool: PoolNode) {
  return pool.position[1] + pool.designWaterElevation
}

export type PoolSpilloverPlacement = Pick<PoolSpilloverNode,
  'position' | 'rotation' | 'sourcePoolId' | 'targetPoolId' | 'connectionMode' | 'sourceOpening' | 'targetOpening' | 'connectionPath' | 'intersection' | 'sourceSide' | 'width' | 'length' | 'dropHeight' | 'waterColor' | 'surfaceColor'
>

export function getPoolWorldPolygon(pool: PoolNode): PoolPoint[] {
  const rotation = pool.rotation[1] ?? 0
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  return resolvePoolPolygon(pool).map(([x, z]) => [
    pool.position[0] + x * cos + z * sin,
    pool.position[2] - x * sin + z * cos,
  ])
}

function dot(a: PoolPoint, b: PoolPoint) { return a[0] * b[0] + a[1] * b[1] }

function openingAround(point: PoolPoint, tangent: PoolPoint, width: number, depth: number): PoolPoint[] {
  const normal: PoolPoint = [-tangent[1], tangent[0]]
  const halfWidth = width / 2
  return [
    [point[0] - tangent[0] * halfWidth - normal[0] * depth, point[1] - tangent[1] * halfWidth - normal[1] * depth],
    [point[0] + tangent[0] * halfWidth - normal[0] * depth, point[1] + tangent[1] * halfWidth - normal[1] * depth],
    [point[0] + tangent[0] * halfWidth + normal[0] * depth, point[1] + tangent[1] * halfWidth + normal[1] * depth],
    [point[0] - tangent[0] * halfWidth + normal[0] * depth, point[1] - tangent[1] * halfWidth + normal[1] * depth],
  ]
}

/** Finds a spillway channel between parallel, facing runs on separated pool shells. */
function findAdjacentSpillway(first: PoolNode, second: PoolNode) {
  const left = getPoolWorldPolygon(first)
  const right = getPoolWorldPolygon(second)
  let best: {
    gap: number
    width: number
    position: PoolPoint
    tangent: PoolPoint
    poolPoints: [PoolPoint, PoolPoint]
  } | null = null
  for (let i = 0; i < left.length; i += 1) {
    const a = left[i]!
    const b = left[(i + 1) % left.length]!
    const tangent: PoolPoint = [b[0] - a[0], b[1] - a[1]]
    const segmentLength = Math.hypot(tangent[0], tangent[1])
    if (segmentLength < 0.001) continue
    tangent[0] /= segmentLength; tangent[1] /= segmentLength
    const normal: PoolPoint = [-tangent[1], tangent[0]]
    const leftLine = dot(a, normal)
    const leftStart = dot(a, tangent)
    const leftEnd = dot(b, tangent)
    for (let j = 0; j < right.length; j += 1) {
      const c = right[j]!
      const d = right[(j + 1) % right.length]!
      const other: PoolPoint = [d[0] - c[0], d[1] - c[1]]
      const otherLength = Math.hypot(other[0], other[1])
      if (otherLength < 0.001) continue
      other[0] /= otherLength; other[1] /= otherLength
      if (Math.abs(tangent[0] * other[1] - tangent[1] * other[0]) > 0.2) continue
      const rightStart = dot(c, tangent)
      const rightEnd = dot(d, tangent)
      const width = Math.min(Math.max(leftStart, leftEnd), Math.max(rightStart, rightEnd)) -
        Math.max(Math.min(leftStart, leftEnd), Math.min(rightStart, rightEnd))
      if (width < 0.4) continue
      const rightLine = dot(c, normal)
      const gap = Math.abs(rightLine - leftLine)
      if (gap > MAX_CONNECTION_LENGTH || (best && (gap > best.gap || (gap === best.gap && width < best.width)))) continue
      const along = (Math.max(Math.min(leftStart, leftEnd), Math.min(rightStart, rightEnd)) +
        Math.min(Math.max(leftStart, leftEnd), Math.max(rightStart, rightEnd))) / 2
      const center: PoolPoint = [tangent[0] * along, tangent[1] * along]
      const position: PoolPoint = [center[0] + normal[0] * (leftLine + rightLine) / 2, center[1] + normal[1] * (leftLine + rightLine) / 2]
      const firstPoint: PoolPoint = [center[0] + normal[0] * leftLine, center[1] + normal[1] * leftLine]
      const secondPoint: PoolPoint = [center[0] + normal[0] * rightLine, center[1] + normal[1] * rightLine]
      best = { gap, width, position, tangent: [tangent[0], tangent[1]], poolPoints: [firstPoint, secondPoint] }
    }
  }
  if (!best) return null
  const halfWidth = best.width * 0.45
  const halfLength = Math.max(0.06, best.gap / 2 + POOL_OPENING_DEPTH)
  const normal: PoolPoint = [-best.tangent[1], best.tangent[0]]
  const p = best.position
  const intersection: PoolPoint[][] = [[
    [p[0] - best.tangent[0] * halfWidth - normal[0] * halfLength, p[1] - best.tangent[1] * halfWidth - normal[1] * halfLength],
    [p[0] + best.tangent[0] * halfWidth - normal[0] * halfLength, p[1] + best.tangent[1] * halfWidth - normal[1] * halfLength],
    [p[0] + best.tangent[0] * halfWidth + normal[0] * halfLength, p[1] + best.tangent[1] * halfWidth + normal[1] * halfLength],
    [p[0] - best.tangent[0] * halfWidth + normal[0] * halfLength, p[1] - best.tangent[1] * halfWidth + normal[1] * halfLength],
  ]]
  return { position: [p[0], 0, p[1]] as [number, number, number], rotation: [0, Math.atan2(best.tangent[0], best.tangent[1]), 0] as [number, number, number], length: Math.max(0.12, best.gap), width: Math.max(0.3, best.width * 0.9), intersection, poolPoints: best.poolPoints }
}

/** Resolves a directional spillover using two nearby pool polygons. */
export function resolvePoolSpillover(
  first: PoolNode,
  second: PoolNode,
  connectionStyle: PoolSpilloverNode['connectionStyle'] = 'auto',
  requestedWidth?: number,
): PoolSpilloverPlacement | null {
  if (first.parentId !== second.parentId) return null
  const sharedJoint = findSharedPoolJoint(first, second)
  const joint = sharedJoint ?? findAdjacentSpillway(first, second)
  if (!joint || joint.width < 0.3) return null
  const source = worldWaterHeight(first) >= worldWaterHeight(second) ? first : second
  const target = source.id === first.id ? second : first
  const sourceIndex = source.id === first.id ? 0 : 1
  const sourcePoint = joint.poolPoints[sourceIndex]!
  const targetPoint = joint.poolPoints[sourceIndex === 0 ? 1 : 0]!
  const availableWidth = joint.width
  const width = Math.min(requestedWidth ?? availableWidth, availableWidth)
  const angle = joint.rotation[1] ?? 0
  const tangent: PoolPoint = [Math.sin(angle), Math.cos(angle)]
  const deltaX = source.position[0] - joint.position[0]
  const deltaZ = source.position[2] - joint.position[2]
  const sourceSide = (deltaX * Math.cos(angle) - deltaZ * Math.sin(angle)) >= 0 ? 1 : -1
  const dropHeight = Math.max(0.02, worldWaterHeight(source) - worldWaterHeight(target))
  return {
    position: [joint.position[0], worldWaterHeight(source), joint.position[2]],
    rotation: joint.rotation,
    sourcePoolId: source.id,
    targetPoolId: target.id,
    connectionMode: connectionStyle === 'watercourse'
      ? 'channel'
      : connectionStyle === 'direct-spillover'
        ? 'direct'
        : sharedJoint ? 'overlap' : 'channel',
    sourceOpening: openingAround(sourcePoint, tangent, width, Math.max(POOL_OPENING_DEPTH, source.shellThickness + 0.05)),
    targetOpening: openingAround(targetPoint, tangent, width, Math.max(POOL_OPENING_DEPTH, target.shellThickness + 0.05)),
    connectionPath: [sourcePoint, targetPoint],
    intersection: joint.intersection,
    sourceSide,
    width,
    length: Math.max(0.1, joint.length),
    dropHeight,
    waterColor: source.waterColor,
    surfaceColor: source.copingColor,
  }
}

export function isPoolSpilloverEndpoint(node: PoolSpilloverNode, poolId: string) {
  return node.sourcePoolId === poolId || node.targetPoolId === poolId
}

export function isPoolPolygonUsable(pool: PoolNode) {
  return resolvePoolPolygon(pool).length >= 3
}
