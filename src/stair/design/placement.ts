import { resolvePoolPolygon, type PoolNode } from '../../core/schema'
import type { PoolStairNode } from '../core/schema'

export type PoolStairAttachment = {
  poolId: string
  wallIndex: number
  wallT: number
  distance: number
  position: [number, number, number]
  rotation: [number, number, number]
  localPosition: [number, number, number]
  localRotation: [number, number, number]
}

function polygonSignedArea(polygon: readonly (readonly [number, number])[]) {
  return polygon.reduce((area, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return next ? area + point[0] * next[1] - next[0] * point[1] : area
  }, 0) / 2
}

function planToPoolLocal(pool: PoolNode, point: readonly [number, number, number]) {
  const yaw = pool.rotation[1]
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const dx = point[0] - pool.position[0]
  const dz = point[2] - pool.position[2]
  return [dx * cos - dz * sin, dx * sin + dz * cos] as const
}

function poolLocalToPlan(pool: PoolNode, x: number, z: number): [number, number, number] {
  const yaw = pool.rotation[1]
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return [
    pool.position[0] + x * cos + z * sin,
    pool.position[1] + pool.finishedDeckElevation,
    pool.position[2] - x * sin + z * cos,
  ]
}

function attachmentOnEdge(
  pool: PoolNode,
  wallIndex: number,
  wallT: number,
  distance: number,
): PoolStairAttachment | null {
  const polygon = resolvePoolPolygon(pool)
  if (polygon.length < 2) return null
  const index = ((wallIndex % polygon.length) + polygon.length) % polygon.length
  const start = polygon[index]
  const end = polygon[(index + 1) % polygon.length]
  if (!start || !end) return null
  const edgeX = end[0] - start[0]
  const edgeZ = end[1] - start[1]
  const edgeLength = Math.hypot(edgeX, edgeZ)
  if (edgeLength <= Number.EPSILON) return null

  const t = Math.max(0, Math.min(1, wallT))
  const x = start[0] + edgeX * t
  const z = start[1] + edgeZ * t
  const ccw = polygonSignedArea(polygon) >= 0
  const inwardX = (ccw ? -edgeZ : edgeZ) / edgeLength
  const inwardZ = (ccw ? edgeX : -edgeX) / edgeLength
  const localYaw = Math.atan2(inwardX, inwardZ)

  return {
    poolId: pool.id,
    wallIndex: index,
    wallT: t,
    distance,
    position: poolLocalToPlan(pool, x, z),
    rotation: [0, pool.rotation[1] + localYaw, 0],
    localPosition: [x, pool.finishedDeckElevation, z],
    localRotation: [0, localYaw, 0],
  }
}

/** Resolves the same pool-wall attachment used by placement and later moves. */
export function findNearestPoolStairAttachment(
  point: readonly [number, number, number],
  pools: readonly PoolNode[],
): PoolStairAttachment | null {
  let nearest: PoolStairAttachment | null = null
  for (const pool of pools) {
    const [pointX, pointZ] = planToPoolLocal(pool, point)
    const polygon = resolvePoolPolygon(pool)
    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]
      const end = polygon[(index + 1) % polygon.length]
      if (!start || !end) continue
      const edgeX = end[0] - start[0]
      const edgeZ = end[1] - start[1]
      const edgeLengthSquared = edgeX * edgeX + edgeZ * edgeZ
      if (edgeLengthSquared <= Number.EPSILON) continue
      const t = Math.max(0, Math.min(1, (
        (pointX - start[0]) * edgeX + (pointZ - start[1]) * edgeZ
      ) / edgeLengthSquared))
      const hitX = start[0] + edgeX * t
      const hitZ = start[1] + edgeZ * t
      const distance = Math.hypot(pointX - hitX, pointZ - hitZ)
      if (nearest && distance >= nearest.distance) continue
      nearest = attachmentOnEdge(pool, index, t, distance)
    }
  }
  return nearest
}

export function poolStairAttachmentOnWall(
  pool: PoolNode,
  wallIndex: number,
  wallT: number,
) {
  return attachmentOnEdge(pool, wallIndex, wallT, 0)
}

export function poolStairAttachmentPatch(attachment: PoolStairAttachment) {
  return {
    parentId: attachment.poolId,
    poolId: attachment.poolId,
    wallIndex: attachment.wallIndex,
    wallT: attachment.wallT,
    position: attachment.localPosition,
    rotation: attachment.localRotation,
  }
}

/** Resolves child-local transforms while retaining compatibility with older level children. */
export function resolveMountedPoolStair(
  stair: PoolStairNode,
  pool: PoolNode | null | undefined,
): PoolStairNode {
  if (!pool || stair.poolId !== pool.id) return stair
  const attachment = poolStairAttachmentOnWall(pool, stair.wallIndex, stair.wallT)
  if (!attachment) return stair
  return {
    ...stair,
    position: stair.parentId === pool.id ? attachment.localPosition : attachment.position,
    rotation: stair.parentId === pool.id ? attachment.localRotation : attachment.rotation,
  }
}
