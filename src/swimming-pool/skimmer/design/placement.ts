import { resolvePoolPolygon, type PoolNode } from '../../core/schema'
import type { PoolSkimmerNode } from '../core/schema'

export type SkimmerPlacement = {
  position: [number, number, number]
  rotation: [number, number, number]
  distance: number
  wallIndex: number
  wallT: number
  poolId: string | null
}

function closestPointOnSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax
  const dz = bz - az
  const lengthSquared = dx * dx + dz * dz
  const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSquared)) : 0
  const x = ax + dx * t
  const z = az + dz * t
  return { x, z, distance: Math.hypot(px - x, pz - z) }
}

function polygonSignedArea(polygon: readonly (readonly [number, number])[]) {
  return polygon.reduce((area, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    if (!next) return area
    return area + point[0] * next[1] - next[0] * point[1]
  }, 0) / 2
}

/** Find the nearest pool edge and make local +Z point toward the basin. */
export function findNearestPoolWall(point: readonly [number, number], pools: readonly PoolNode[]): SkimmerPlacement | null {
  let best: SkimmerPlacement | null = null
  for (const pool of pools) {
    const polygon = resolvePoolPolygon(pool)
    // For a CCW polygon, the left-hand normal of each edge points inward;
    // for a CW polygon, the right-hand normal does. This gives every flat
    // wall a constant orientation instead of a centroid-based rotating one.
    const isCounterClockwise = polygonSignedArea(polygon) >= 0
    for (let index = 0; index < polygon.length; index += 1) {
      const a = polygon[index]
      const b = polygon[(index + 1) % polygon.length]
      if (!a || !b) continue
      const hit = closestPointOnSegment(point[0] - pool.position[0], point[1] - pool.position[2], a[0], a[1], b[0], b[1])
      if (best && hit.distance >= best.distance) continue
      const edgeX = b[0] - a[0]
      const edgeZ = b[1] - a[1]
      const edgeLength = Math.hypot(edgeX, edgeZ)
      if (edgeLength <= Number.EPSILON) continue
      const leftNormalX = -edgeZ / edgeLength
      const leftNormalZ = edgeX / edgeLength
      const inwardX = isCounterClockwise ? leftNormalX : -leftNormalX
      const inwardZ = isCounterClockwise ? leftNormalZ : -leftNormalZ
      const angle = Math.atan2(inwardX, inwardZ)
      best = {
        position: [hit.x + pool.position[0], pool.position[1] + pool.designWaterElevation, hit.z + pool.position[2]],
        rotation: [0, angle, 0],
        distance: hit.distance,
        wallIndex: index,
        wallT: Math.max(0, Math.min(1, Math.hypot(hit.x - a[0], hit.z - a[1]) / edgeLength)),
        poolId: pool.id,
      }
    }
  }
  return best
}

export function placementOnPoolWall(pool: PoolNode, wallIndex: number, wallT: number): SkimmerPlacement | null {
  const polygon = resolvePoolPolygon(pool)
  const index = ((wallIndex % polygon.length) + polygon.length) % polygon.length
  const a = polygon[index]
  const b = polygon[(index + 1) % polygon.length]
  if (!a || !b) return null
  const t = Math.max(0, Math.min(1, wallT))
  const edgeX = b[0] - a[0]
  const edgeZ = b[1] - a[1]
  const length = Math.hypot(edgeX, edgeZ)
  if (length <= Number.EPSILON) return null
  const ccw = polygonSignedArea(polygon) >= 0
  const leftX = -edgeZ / length
  const leftZ = edgeX / length
  const inwardX = ccw ? leftX : -leftX
  const inwardZ = ccw ? leftZ : -leftZ
  return {
    position: [pool.position[0] + a[0] + edgeX * t, pool.position[1] + pool.designWaterElevation, pool.position[2] + a[1] + edgeZ * t],
    rotation: [0, Math.atan2(inwardX, inwardZ), 0],
    distance: 0,
    wallIndex: index,
    wallT: t,
    poolId: pool.id,
  }
}

export function resolveMountedSkimmer(node: PoolSkimmerNode, pool: PoolNode | null | undefined): PoolSkimmerNode {
  if (!pool || node.poolId !== pool.id) return node
  const placement = placementOnPoolWall(pool, node.wallIndex, node.wallT)
  return placement ? { ...node, position: placement.position, rotation: placement.rotation } : node
}
