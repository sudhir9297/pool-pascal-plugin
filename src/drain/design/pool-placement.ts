import { Euler, Vector3 } from 'three'
import { resolvePoolPolygon, type PoolNode } from '../../core/schema'
import { getPoolDepthResolver } from '../../design/depth-profile'

export type PoolDrainPlacement = {
  position: [number, number, number]
  poolId: string
}

function pointInPolygon(x: number, z: number, polygon: readonly (readonly [number, number])[]) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index]!
    const prior = polygon[previous]!
    if ((current[1] > z) !== (prior[1] > z) && x < ((prior[0] - current[0]) * (z - current[1])) / (prior[1] - current[1]) + current[0]) inside = !inside
  }
  return inside
}

/** Converts a level-space click into a point flush with the selected pool floor. */
export function getPoolDrainPlacement(pool: PoolNode, levelPoint: readonly [number, number, number]): PoolDrainPlacement | null {
  const poolOrigin = new Vector3(...pool.position)
  const localPoint = new Vector3(...levelPoint).sub(poolOrigin).applyEuler(new Euler(-pool.rotation[0], -pool.rotation[1], -pool.rotation[2], 'XYZ'))
  const polygon = resolvePoolPolygon(pool)
  if (!pointInPolygon(localPoint.x, localPoint.z, polygon)) return null

  const depth = getPoolDepthResolver(pool, polygon).depthAtX(localPoint.x)
  const floorPoint = new Vector3(localPoint.x, -depth, localPoint.z)
    .applyEuler(new Euler(...pool.rotation, 'XYZ'))
    .add(poolOrigin)
  return { position: [floorPoint.x, floorPoint.y, floorPoint.z], poolId: pool.id }
}
