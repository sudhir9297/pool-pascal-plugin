import { PipeSegmentNode } from '@pascal-app/core'
import { Euler, Quaternion, Vector3 } from 'three'
import { getValvePortsLocal } from '../core/ports'
import { PoolValveNode } from '../core/schema'

type Point = [number, number, number]
type HostedPipe = PipeSegmentNode & { wallAttachment?: { wallId: string; side: 'front' | 'back'; startUV: [number, number]; endUV: [number, number]; offset: number } }

export function planValveInsertion(run: HostedPipe, index: number, point: Point, template: PoolValveNode) {
  const a = run.path[index]
  const b = run.path[index + 1]
  if (!a || !b || run.system !== 'waste') return null
  const start = new Vector3(...a)
  const delta = new Vector3(...b).sub(start)
  const length = delta.length()
  if (length < 1e-8) return null
  const axis = delta.clone().normalize()
  const t = new Vector3(...point).sub(start).dot(axis)
  const ports = getValvePortsLocal(template)
  const inlet = ports[0]!
  const outlet = ports[1]!
  const localAxis = new Vector3(...outlet.position).sub(new Vector3(...inlet.position)).normalize()
  const rotation = new Quaternion().setFromUnitVectors(localAxis, axis)
  const inletOffset = new Vector3(...inlet.position).applyQuaternion(rotation)
  const outletOffset = new Vector3(...outlet.position).applyQuaternion(rotation)
  const cutStart = t + inletOffset.dot(axis)
  const cutEnd = t + outletOffset.dot(axis)
  if (cutStart < 0.05 || cutEnd > length - 0.05) return null
  const center = start.clone().addScaledVector(axis, t)
  const headEnd = center.clone().add(inletOffset).toArray()
  const tailStart = center.clone().add(outletOffset).toArray()
  const euler = new Euler().setFromQuaternion(rotation)
  const valve = PoolValveNode.parse({ ...template, parentId: run.parentId, position: center.toArray(), rotation: [euler.x, euler.y, euler.z], diameter: run.diameter * 0.0254 })
  const headPath = [...run.path.slice(0, index + 1), headEnd]
  const tailPath = [tailStart, ...run.path.slice(index + 1)]
  let headAttachment = run.wallAttachment
  let tailAttachment = run.wallAttachment
  if (run.wallAttachment) {
    // Wall UV endpoints describe the full straight hosted span, so each cut needs its own UV.
    if (run.path.length !== 2) return null
    const attachment = run.wallAttachment
    const uv = (distance: number): [number, number] => attachment.startUV.map((value, i) => value + (attachment.endUV[i]! - value) * distance / length) as [number, number]
    headAttachment = { ...attachment, endUV: uv(cutStart) }
    tailAttachment = { ...attachment, startUV: uv(cutEnd) }
  }
  return {
    valve,
    update: { id: run.id, data: { path: headPath, wallAttachment: headAttachment } },
    tail: PipeSegmentNode.parse({ ...run, id: undefined, path: tailPath, wallAttachment: tailAttachment }),
  }
}

export function findValveInsertionTarget(runs: PipeSegmentNode[], point: Point, spatial: boolean) {
  let best: { run: PipeSegmentNode; index: number; point: Point } | null = null
  let distance = 0.4
  for (const run of [...runs].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!run.visible || run.system !== 'waste') continue
    for (let index = 0; index < run.path.length - 1; index++) {
      const a = new Vector3(...run.path[index]!)
      const delta = new Vector3(...run.path[index + 1]!).sub(a)
      const projected = delta.clone()
      const offset = new Vector3(...point).sub(a)
      if (!spatial) { projected.y = 0; offset.y = 0 }
      if (projected.lengthSq() < 1e-8) continue
      const t = Math.max(0, Math.min(1, offset.dot(projected) / projected.lengthSq()))
      const hit = a.addScaledVector(delta, t)
      const d = spatial ? hit.distanceTo(new Vector3(...point)) : Math.hypot(hit.x - point[0], hit.z - point[2])
      if (d >= distance) continue
      distance = d
      best = { run, index, point: hit.toArray() }
    }
  }
  return best
}
