import type { NodePort, PipeFittingNode, PipeSegmentNode } from '@pascal-app/core'
import { Vector3 } from 'three'

type Volume = { id: string; a: Vector3; b: Vector3; radius: number; sockets: Vector3[] }
const GAP = 0.025

export function pipeVolumes(pipes: readonly PipeSegmentNode[], fittings: readonly PipeFittingNode[], ports: (node: PipeFittingNode) => readonly NodePort[]): Volume[] {
  return [
    ...pipes.flatMap((pipe) => {
      const points = pipe.path.map((p) => new Vector3(...p))
      return points.slice(1).map((b, i) => ({ id: pipe.id, a: points[i]!, b, radius: pipe.diameter * 0.0254 / 2 * 1.12, sockets: [points[0]!, points.at(-1)!] }))
    }),
    ...fittings.map((fitting) => {
      const center = new Vector3(...fitting.position)
      const sockets = ports(fitting).map((port) => new Vector3(...port.position))
      // Enclose the complete elbow/tee body and its larger socket collars.
      const radius = Math.max(...sockets.map((p) => p.distanceTo(center)), 0.07) + Math.max(fitting.diameter, fitting.diameter2) * 0.0254 / 2 * 1.3
      return { id: fitting.id, a: center, b: center, radius, sockets }
    }),
  ]
}

export function segmentDistance(a: Vector3, b: Vector3, c: Vector3, d: Vector3) {
  const u = b.clone().sub(a), v = d.clone().sub(c), w = a.clone().sub(c)
  const uu = u.dot(u), vv = v.dot(v), uv = u.dot(v), uw = u.dot(w), vw = v.dot(w)
  const clamp = (n: number) => Math.max(0, Math.min(1, n))
  if (uu < 1e-12 && vv < 1e-12) return a.distanceTo(c)
  let s = uu < 1e-12 ? 0 : vv < 1e-12 ? clamp(-uw / uu) : Math.abs(uu * vv - uv * uv) < 1e-12 ? 0 : clamp((uv * vw - uw * vv) / (uu * vv - uv * uv))
  let t = vv < 1e-12 ? 0 : (uv * s + vw) / vv
  if (t < 0) { t = 0; s = uu < 1e-12 ? 0 : clamp(-uw / uu) }
  if (t > 1) { t = 1; s = uu < 1e-12 ? 0 : clamp((uv - uw) / uu) }
  return w.addScaledVector(u, s).addScaledVector(v, -t).length()
}

function overlaps(a: Volume, b: Volume, connected: boolean) {
  if (connected && (a.id === b.id || a.sockets.some((p) => b.sockets.some((q) => p.distanceToSquared(q) < 1e-12)))) return false
  const distance = a.radius + b.radius + GAP
  if (['x', 'y', 'z'].some((axis) => {
    const key = axis as 'x' | 'y' | 'z'
    return Math.max(a.a[key], a.b[key]) + distance <= Math.min(b.a[key], b.b[key]) || Math.max(b.a[key], b.b[key]) + distance <= Math.min(a.a[key], a.b[key])
  })) return false
  return segmentDistance(a.a, a.b, b.a, b.b) < distance - 1e-6
}

export function pipeVolumesOverlap(candidate: readonly Volume[], existing: readonly Volume[] = []) {
  return candidate.some((a, i) => existing.some((b) => overlaps(a, b, false)) || candidate.slice(i + 1).some((b) => overlaps(a, b, true)))
}
