import { Vector3, type Object3D } from 'three'

export type PoolLevelPoint = [number, number, number]

/**
 * Pool nodes are parented to a level, while grid and node events report a
 * world-space hit. Convert at the boundary so placement and snapping
 * routing always use the node's actual parent frame.
 */
export function worldPointToPoolLevel(
  level: Object3D | null | undefined,
  worldPoint: readonly [number, number, number],
): PoolLevelPoint {
  const point = new Vector3(...worldPoint)
  level?.worldToLocal(point)
  return [point.x, point.y, point.z]
}
