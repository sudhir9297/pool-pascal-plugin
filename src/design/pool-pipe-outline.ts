import type { Vector3 } from 'three'
import type { PoolPoint } from '../core/schema'

/** Signed distance: negative inside the basin, positive outside its boundary. */
export function poolOutlineDistance(point: Vector3, polygon: readonly PoolPoint[]) {
  let inside = false
  let distance = Infinity
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!
    const dx = b[0] - a[0], dz = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((point.x - a[0]) * dx + (point.z - a[1]) * dz) / (dx * dx + dz * dz)))
    distance = Math.min(distance, Math.hypot(point.x - a[0] - t * dx, point.z - a[1] - t * dz))
    if ((a[1] > point.z) !== (b[1] > point.z) && point.x < a[0] + dx * (point.z - a[1]) / dz) inside = !inside
  }
  return inside ? -distance : distance
}
