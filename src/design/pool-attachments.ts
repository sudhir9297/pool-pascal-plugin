import { Euler, Quaternion, Vector3 } from 'three'
import { PoolNode, resolvePoolPolygon } from '../core/schema'
import { PoolDrainNode } from '../drain/core/schema'
import { PoolInletNode } from '../inlet/core/schema'
import { PoolSkimmerNode } from '../skimmer/core/schema'
import { PoolStairNode } from '../stair/core/schema'
import { PoolWaterfallNode } from '../water-feature/waterfall/core/schema'
import { resolveMountedInlet } from '../inlet/design/placement'
import { resolveMountedSkimmer } from '../skimmer/design/placement'
import { resolveMountedPoolStair } from '../stair/design/placement'
import { resolveMountedWaterfall } from '../water-feature/waterfall/design/placement'
import { getPoolDepthResolver } from './depth-profile'

const schemas = [PoolDrainNode, PoolInletNode, PoolSkimmerNode, PoolStairNode, PoolWaterfallNode]

function remapWallAnchor<T extends { position: [number, number, number]; wallIndex?: number; wallT?: number }>(node: T, pool: PoolNode): T {
  const polygon = resolvePoolPolygon(pool)
  if (
    polygon.length < 2 ||
    node.wallIndex === undefined ||
    node.wallT === undefined ||
    (node.wallIndex >= 0 && node.wallIndex < polygon.length)
  ) return node
  let bestIndex = 0
  let bestT = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < polygon.length; index += 1) {
    const [ax, az] = polygon[index]!
    const [bx, bz] = polygon[(index + 1) % polygon.length]!
    const dx = bx - ax
    const dz = bz - az
    const lengthSquared = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((node.position[0] - ax) * dx + (node.position[2] - az) * dz) / lengthSquared))
    const distance = (node.position[0] - (ax + dx * t)) ** 2 + (node.position[2] - (az + dz * t)) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
      bestT = t
    }
  }
  return { ...node, wallIndex: bestIndex, wallT: bestT } as T
}

/** Convert existing level siblings and recompute attachments in the pool's own frame. */
export function resolvePoolAttachment(value: unknown, pool: PoolNode) {
  const parsed = schemas.map((schema) => schema.safeParse(value)).find((result) => result.success)
  if (!parsed?.success || parsed.data.poolId !== pool.id) return null
  const node = parsed.data
  const local = node.parentId === pool.id
    ? new Vector3(...node.position)
    : new Vector3(...node.position).sub(new Vector3(...pool.position))
      .applyQuaternion(new Quaternion().setFromEuler(new Euler(...pool.rotation)).invert())
  const child = remapWallAnchor(
    { ...node, parentId: pool.id, position: local.toArray() as [number, number, number] },
    pool,
  )
  switch (child.type) {
    case 'pool:skimmer': return resolveMountedSkimmer(child, pool)
    case 'pool:inlet': return resolveMountedInlet(child, pool)
    case 'pool:stair': return resolveMountedPoolStair(child, pool)
    case 'pool:waterfall': return resolveMountedWaterfall(child, pool)
    case 'pool:drain': {
      const polygon = resolvePoolPolygon(pool)
      const minX = Math.min(...polygon.map(([x]) => x))
      const maxX = Math.max(...polygon.map(([x]) => x))
      const minZ = Math.min(...polygon.map(([, z]) => z))
      const maxZ = Math.max(...polygon.map(([, z]) => z))
      const floorAnchor = child.floorAnchor ?? [
        (local.x - minX) / (maxX - minX || 1),
        (local.z - minZ) / (maxZ - minZ || 1),
      ]
      const x = minX + floorAnchor[0] * (maxX - minX)
      const z = minZ + floorAnchor[1] * (maxZ - minZ)
      return { ...child, floorAnchor, position: [x, -getPoolDepthResolver(pool, polygon).depthAtX(x), z] as [number, number, number] }
    }
  }
}

export function poolAttachmentUpdates(nodes: Record<string, unknown>) {
  const updates: { id: string; data: Record<string, unknown> }[] = []
  for (const value of Object.values(nodes)) {
    if (!value || typeof value !== 'object' || !('poolId' in value) || typeof value.poolId !== 'string') continue
    const pool = PoolNode.safeParse(nodes[value.poolId])
    if (!pool.success) continue
    const resolved = resolvePoolAttachment(value, pool.data)
    if (!resolved) continue
    const data = Object.fromEntries(Object.entries(resolved).filter(([key, field]) =>
      JSON.stringify(field) !== JSON.stringify((value as Record<string, unknown>)[key]),
    ))
    if (Object.keys(data).length) updates.push({ id: resolved.id, data })
  }
  return updates
}
