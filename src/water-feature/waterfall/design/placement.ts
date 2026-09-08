import { getPoolWaterLandingInset } from '../../../design/water-landing'
import { resolvePoolPolygon, type PoolNode } from '../../../core/schema'
import type { WaterPreset } from '../../../shader/water-presets'
import type { PoolWaterfallNode } from '../core/schema'

export type WaterfallPlacement = {
  position: [number, number, number]
  rotation: [number, number, number]
  distance: number
  poolId: string | null
  wallIndex: number
  wallT: number
  edgeCurve: Array<[number, number]>
  landingInset: number
  targetWaterOffset: number
  waterPreset: WaterPreset
  shallowWaterColor: string
  deepWaterColor: string
  poolRockSeed: number | null
}

function poolWallLength(pool: PoolNode, wallIndex: number) {
  const polygon = resolvePoolPolygon(pool)
  const index = ((wallIndex % polygon.length) + polygon.length) % polygon.length
  const start = polygon[index]
  const end = polygon[(index + 1) % polygon.length]
  return start && end ? Math.hypot(end[0] - start[0], end[1] - start[1]) : 0
}

/** Small, proportional defaults for a waterfall mounted on a pool wall. */
export function getMountedWaterfallDimensions(pool: PoolNode, wallIndex: number) {
  const wallLength = poolWallLength(pool, wallIndex)
  const width = Math.max(0.8, Math.min(1.8, wallLength * 0.24))
  return {
    width,
    height: Math.max(0.55, Math.min(1.05, width * 0.58)),
    depth: Math.max(0.45, Math.min(0.85, width * 0.46)),
  }
}

function signedArea(points: readonly (readonly [number, number])[]) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!
    return sum + point[0] * next[1] - next[0] * point[1]
  }, 0) / 2
}

function closestPoint(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax
  const dz = bz - az
  const lengthSquared = dx * dx + dz * dz
  const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSquared)) : 0
  const x = ax + dx * t
  const z = az + dz * t
  return { x, z, t, distance: Math.hypot(px - x, pz - z) }
}

function toPoolLocal(point: readonly [number, number], pool: PoolNode): [number, number] {
  const angle = pool.rotation[1]
  const dx = point[0] - pool.position[0]
  const dz = point[1] - pool.position[2]
  return [dx * Math.cos(angle) - dz * Math.sin(angle), dx * Math.sin(angle) + dz * Math.cos(angle)]
}

function toWorld(point: readonly [number, number], pool: PoolNode): [number, number] {
  const angle = pool.rotation[1]
  return [
    pool.position[0] + point[0] * Math.cos(angle) + point[1] * Math.sin(angle),
    pool.position[2] - point[0] * Math.sin(angle) + point[1] * Math.cos(angle),
  ]
}

export function findNearestWaterfallPlacement(
  point: readonly [number, number],
  pools: readonly PoolNode[],
  width: number,
  maxDistance = Math.max(2, width),
): WaterfallPlacement | null {
  let best: WaterfallPlacement | null = null
  for (const pool of pools) {
    const polygon = resolvePoolPolygon(pool)
    const local = toPoolLocal(point, pool)
    for (let wallIndex = 0; wallIndex < polygon.length; wallIndex += 1) {
      const a = polygon[wallIndex]!
      const b = polygon[(wallIndex + 1) % polygon.length]!
      const hit = closestPoint(local[0], local[1], a[0], a[1], b[0], b[1])
      if (hit.distance > maxDistance || best && hit.distance >= best.distance) continue
      const candidate = placementOnPoolBoundary(pool, wallIndex, hit.t, width)
      if (!candidate) continue
      candidate.distance = hit.distance
      best = candidate
    }
  }
  return best
}

export function createStandaloneWaterfallPlacement(
  position: readonly [number, number, number],
  node: PoolWaterfallNode,
): WaterfallPlacement {
  return {
    position: [...position],
    rotation: [...node.rotation],
    distance: Number.POSITIVE_INFINITY,
    poolId: null,
    wallIndex: node.wallIndex,
    wallT: node.wallT,
    edgeCurve: node.edgeCurve.map(([x, z]) => [x, z]),
    landingInset: 0,
    targetWaterOffset: 0,
    waterPreset: node.waterPreset,
    shallowWaterColor: node.shallowWaterColor,
    deepWaterColor: node.deepWaterColor,
    poolRockSeed: null,
  }
}

export function placementOnPoolBoundary(pool: PoolNode, wallIndex: number, wallT: number, width: number): WaterfallPlacement | null {
  const polygon = resolvePoolPolygon(pool)
  if (polygon.length < 3) return null
  const index = ((wallIndex % polygon.length) + polygon.length) % polygon.length
  const a = polygon[index]!
  const b = polygon[(index + 1) % polygon.length]!
  const edgeX = b[0] - a[0]
  const edgeZ = b[1] - a[1]
  const edgeLength = Math.hypot(edgeX, edgeZ)
  if (edgeLength <= Number.EPSILON) return null
  const t = Math.max(0, Math.min(1, wallT))
  const anchor: [number, number] = [a[0] + edgeX * t, a[1] + edgeZ * t]
  const ccw = signedArea(polygon) >= 0
  const tangentX = (ccw ? edgeX : -edgeX) / edgeLength
  const tangentZ = (ccw ? edgeZ : -edgeZ) / edgeLength
  const inwardX = -tangentZ
  const inwardZ = tangentX
  const localAngle = Math.atan2(inwardX, inwardZ)
  const world = toWorld(anchor, pool)
  return {
    position: [world[0], pool.position[1] + pool.finishedDeckElevation, world[1]],
    rotation: [0, pool.rotation[1] + localAngle, 0],
    distance: 0,
    poolId: pool.id,
    wallIndex: index,
    wallT: t,
    edgeCurve: sampleBoundaryCurve(polygon, index, t, width, localAngle, ccw, anchor),
    landingInset: getPoolWaterLandingInset(pool),
    targetWaterOffset: pool.designWaterElevation - pool.finishedDeckElevation,
    waterPreset: pool.waterPreset,
    shallowWaterColor: pool.shallowWaterColor,
    deepWaterColor: pool.deepWaterColor,
    poolRockSeed: pool.copingSeed,
  }
}

export function resolveMountedWaterfall(node: PoolWaterfallNode, pool: PoolNode | null | undefined): PoolWaterfallNode {
  if (!pool || node.poolId !== pool.id) return node
  if (node.parentId === pool.id) pool = { ...pool, position: [0, 0, 0], rotation: [0, 0, 0] }
  const dimensions = node.autoSizeOnPool && node.waterfallType === 'modern'
    ? getMountedWaterfallDimensions(pool, node.wallIndex)
    : null
  const placement = placementOnPoolBoundary(pool, node.wallIndex, node.wallT, dimensions?.width ?? node.width)
  return placement ? {
    ...node,
    ...(dimensions ?? {}),
    position: placement.position,
    rotation: placement.rotation,
    poolId: placement.poolId,
    wallIndex: placement.wallIndex,
    wallT: placement.wallT,
    edgeCurve: placement.edgeCurve,
    landingInset: placement.landingInset,
    targetWaterOffset: placement.targetWaterOffset,
    waterPreset: placement.waterPreset,
    shallowWaterColor: placement.shallowWaterColor,
    deepWaterColor: placement.deepWaterColor,
    poolRockSeed: placement.poolRockSeed,
    receivingPoolEnabled: false,
  } : node
}

function sampleBoundaryCurve(
  polygon: readonly (readonly [number, number])[], wallIndex: number, wallT: number, width: number,
  localAngle: number, ccw: boolean, anchor: readonly [number, number],
) {
  const lengths = polygon.map((point, index) => {
    const next = polygon[(index + 1) % polygon.length]!
    return Math.hypot(next[0] - point[0], next[1] - point[1])
  })
  const perimeter = lengths.reduce((sum, length) => sum + length, 0)
  const anchorDistance = lengths.slice(0, wallIndex).reduce((sum, length) => sum + length, 0) + lengths[wallIndex]! * wallT
  const result: Array<[number, number]> = []
  for (let sample = 0; sample < 9; sample += 1) {
    const expectedX = (sample / 8 - 0.5) * width * 1.15
    const distance = anchorDistance + expectedX * (ccw ? 1 : -1)
    const point = pointAtDistance(polygon, lengths, perimeter, distance)
    const dx = point[0] - anchor[0]
    const dz = point[1] - anchor[1]
    // Keep the waterfall's local X samples ordered even when the boundary
    // makes a 90-degree turn. On a short L-shape wall, the projected boundary
    // points can otherwise share the same X and make the rock curve fold.
    const localDepth = dx * Math.sin(localAngle) + dz * Math.cos(localAngle)
    result.push([expectedX, localDepth])
  }
  return result
}

function pointAtDistance(polygon: readonly (readonly [number, number])[], lengths: readonly number[], perimeter: number, distance: number) {
  let remaining = ((distance % perimeter) + perimeter) % perimeter
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index]!
    if (remaining <= length) {
      const a = polygon[index]!
      const b = polygon[(index + 1) % polygon.length]!
      const t = length > 0 ? remaining / length : 0
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as const
    }
    remaining -= length
  }
  return polygon[0]!
}
