import { PipeFittingNode, PipeSegmentNode, type NodePort } from '@pascal-app/core'
import { Box3, Euler, Matrix4, Vector3 } from 'three'
import { rotateVectorXYZ } from '../core/connection-ports'
import { getPumpPortsLocal } from '../pump/core/ports'
import { PoolPumpNode } from '../pump/core/schema'
import { getFilterConnectionPortsLocal } from '../filter/core/ports'
import { PoolFilterNode } from '../filter/core/schema'
import { getHeaterConnectionPortsLocal } from '../heater/core/ports'
import { PoolHeaterNode } from '../heater/core/schema'
import { routePipe, type RouteObstacle, type RoutePoint } from './pipe-route'

export type InsertableEquipment = PoolPumpNode | PoolFilterNode | PoolHeaterNode
export type FittingPorts = (node: PipeFittingNode) => NodePort[]
export type EquipmentInsertionPlan = {
  equipment: InsertableEquipment
  update: { id: PipeSegmentNode['id']; data: Partial<PipeSegmentNode> }
  tail: PipeSegmentNode
  members: Array<PipeSegmentNode | PipeFittingNode>
}

export function isInsertableEquipment(node: { type: string }): node is InsertableEquipment {
  return ['pool:pump', 'pool:filter', 'pool:heater'].includes(node.type)
}

export function equipmentPortsLocal(node: InsertableEquipment) {
  if (node.type === 'pool:pump') return getPumpPortsLocal(node)
  if (node.type === 'pool:filter') return getFilterConnectionPortsLocal(node)
  return getHeaterConnectionPortsLocal(node)
}

export function planEquipmentInsertion(
  run: PipeSegmentNode, index: number, point: RoutePoint, template: InsertableEquipment,
  localBounds: Box3, fittingPorts: FittingPorts, obstacles: RouteObstacle[] = [],
): EquipmentInsertionPlan | null {
  const search = equipmentInsertionSearch(run, index, point, template, localBounds, fittingPorts, obstacles)
  let step = search.next()
  while (!step.done) step = search.next(routePipe(...step.value))
  return step.value
}

export async function planEquipmentInsertionAsync(
  args: Parameters<typeof planEquipmentInsertion>,
  route: (args: Parameters<typeof routePipe>) => Promise<ReturnType<typeof routePipe>>,
): Promise<EquipmentInsertionPlan | null> {
  const search = equipmentInsertionSearch(...args)
  let step = search.next()
  while (!step.done) step = search.next(await route(step.value))
  return step.value
}

function* equipmentInsertionSearch(
  run: PipeSegmentNode, index: number, point: RoutePoint, template: InsertableEquipment,
  localBounds: Box3, fittingPorts: FittingPorts, obstacles: RouteObstacle[] = [],
): Generator<Parameters<typeof routePipe>, EquipmentInsertionPlan | null, ReturnType<typeof routePipe>> {
  for (const complex of [false, true]) {
  for (const lead of template.type === 'pool:heater' ? [0.2, 0.3, 0.12, 0.5, 0.8, 1.2] : [0.25, 0.3, 0.2, 0.5, 0.8, 1.2]) {
    for (const clearance of [1, 2, 3]) {
      const plan = yield* tryEquipmentInsertion(run, index, point, template, localBounds, fittingPorts, obstacles, lead, clearance, complex)
      if (plan) return plan
    }
  }
  }
  return null
}

function* tryEquipmentInsertion(
  run: PipeSegmentNode, index: number, point: RoutePoint, template: InsertableEquipment,
  localBounds: Box3, fittingPorts: FittingPorts, obstacles: RouteObstacle[], preferredLead: number, clearance: number, complex: boolean,
): Generator<Parameters<typeof routePipe>, EquipmentInsertionPlan | null, ReturnType<typeof routePipe>> {
  const a = run.path[index], b = run.path[index + 1]
  if (!a || !b || run.system !== 'waste' || localBounds.isEmpty()) return null
  // Hosted paths need their UV endpoints recomputed before they can be split.
  if ('wallAttachment' in run && run.wallAttachment) return null
  const start = new Vector3(...a), axis = new Vector3(...b).sub(start)
  const length = axis.length()
  if (length < 1e-6) return null
  axis.normalize()
  const horizontal = new Vector3(axis.x, 0, axis.z)
  if (horizontal.lengthSq() < 1e-6) return null
  horizontal.normalize()
  const up = new Vector3(0, 1, 0), side = horizontal.clone().cross(up)
  const frame = new Matrix4().makeBasis(horizontal, up, side)
  const inverse = frame.clone().invert()
  const inFrame = (p: readonly number[]) => new Vector3(p[0], p[1], p[2]).applyMatrix4(inverse).toArray()
  const toWorld = (p: RoutePoint) => new Vector3(...p).applyMatrix4(frame).toArray()
  const center = start.clone().addScaledVector(axis, new Vector3(...point).sub(start).dot(axis))
  const position: RoutePoint = [center.x, template.position[1], center.z]
  const size = run.diameter * 0.0254
  const parsed = template.type === 'pool:pump'
    ? PoolPumpNode.safeParse({ ...template, position, diameter: size })
    : template.type === 'pool:filter'
      ? PoolFilterNode.safeParse({ ...template, position, portDiameter: size })
      : PoolHeaterNode.safeParse({ ...template, position, portDiameter: size })
  if (!parsed.success) return null
  const equipment = parsed.data
  const localPorts = equipmentPortsLocal(equipment)
  const sockets = ['inlet', 'outlet'].map(id => {
    const port = localPorts.find(p => p.id === id)!
    const offset = rotateVectorXYZ(port.position, equipment.rotation)
    return { point: inFrame(offset.map((v, i) => v + equipment.position[i]!)), direction: inFrame(rotateVectorXYZ(port.direction, equipment.rotation)) }
  })
  const elbow = PipeFittingNode.parse({ fittingType: 'elbow', diameter: run.diameter, diameter2: run.diameter, pipeMaterial: run.pipeMaterial, system: run.system })
  const leg = Math.max(...fittingPorts(elbow).map(p => new Vector3(...p.position).length()))
  if (!Number.isFinite(leg) || leg <= 0) return null
  const lead = Math.max(preferredLead, leg * (template.type === 'pool:heater' ? 1 : 2) + 0.05)
  const matrix = new Matrix4().makeRotationFromEuler(new Euler(...equipment.rotation)).setPosition(...equipment.position)
  const bounds = localBounds.clone().applyMatrix4(matrix).applyMatrix4(inverse).expandByScalar(size / 2 + 0.025)
  const worldObstacles = obstacles.map(box => {
    const transformed = new Box3(new Vector3(...box.min), new Vector3(...box.max)).applyMatrix4(inverse)
    return { min: transformed.min.toArray(), max: transformed.max.toArray() }
  })
  const c = inFrame(center.toArray())
  const t = center.clone().sub(start).dot(axis)
  const bodyHalf = Math.max(c[0] - bounds.min.x, bounds.max.x - c[0])
  const half = Math.min(bodyHalf + lead * clearance, t - leg - 0.051, length - t - leg - 0.051)
  if (half < bodyHalf + leg + 0.05) return null
  const cuts = [center.clone().addScaledVector(axis, -half).toArray(), center.clone().addScaledVector(axis, half).toArray()]
  const routeCuts = cuts.map(p => [...p] as RoutePoint)
  const adapters: PipeFittingNode[] = []
  if (Math.abs(axis.y) > 1e-6) {
    for (const [i, sign] of [1, -1].entries()) {
      const incoming = axis.clone().multiplyScalar(sign)
      const outgoing = horizontal.clone().multiplyScalar(sign)
      const z = outgoing.clone().addScaledVector(incoming, -incoming.dot(outgoing)).normalize()
      const rotation = new Euler().setFromRotationMatrix(new Matrix4().makeBasis(incoming, z.clone().cross(incoming).normalize(), z))
      const fitting = PipeFittingNode.parse({ ...elbow, id: undefined, name: 'Pool slope transition', position: cuts[i], rotation: [rotation.x, rotation.y, rotation.z], angle: Math.acos(Math.max(-1, Math.min(1, incoming.dot(outgoing)))) * 180 / Math.PI })
      const ports = fittingPorts(fitting)
      cuts[i] = [...ports.find(p => p.id === 'inlet')!.position]
      routeCuts[i] = [...ports.find(p => p.id === 'outlet')!.position]
      adapters.push(fitting)
    }
  }
  const cutDirections: RoutePoint[] = [[1, 0, 0], [-1, 0, 0]]
  const body: RouteObstacle = { min: bounds.min.toArray(), max: bounds.max.toArray(), endHost: true }
  // Equipment stands on its support surface; the space underneath is not a routing corridor.
  body.min[1] = -Infinity
  let paths: RoutePoint[][] | null = null
  for (const order of [[0, 1], [1, 0]]) {
    const routes: RoutePoint[][] = []
    const occupied: RouteObstacle[] = []
    for (const i of order) {
      const socket = sockets[i!]!
      const cut = inFrame(routeCuts[i!]!)
      const floor: RouteObstacle = {
        min: [-Infinity, -Infinity, -Infinity],
        max: [Infinity, Math.min(cut[1], socket.point[1], equipment.position[1] + size / 2) - 1e-5, Infinity],
      }
      const socketLead = lead + (equipment.type === 'pool:heater' && i === 1 ? size * 2 + leg * 2 + 0.05 : 0)
      const maxY = equipment.type === 'pool:heater' ? Math.max(...sockets.map(port => port.point[1]), ...routeCuts.map(point => point[1])) + leg * 2 + 0.05 : Infinity
      const path = yield [cut, socket.point, cutDirections[i!]!, socket.direction, [...worldObstacles, body, ...occupied, floor], lead, leg, undefined, complex, socketLead, maxY]
      if (!path) break
      routes[i!] = path
      for (let j = 1; j < path.length; j++) {
        const box = new Box3().setFromPoints([new Vector3(...path[j - 1]!), new Vector3(...path[j]!)]).expandByScalar(size + 0.02)
        occupied.push({ min: box.min.toArray(), max: box.max.toArray() })
      }
    }
    if (routes[0] && routes[1]) { paths = routes; break }
  }
  if (!paths) return null
  const members: EquipmentInsertionPlan['members'] = [...adapters]
  for (const routed of paths) {
    const path = routed.map(toWorld)
    const starts = path.slice(0, -1).map(p => [...p] as RoutePoint)
    const ends = path.slice(1).map(p => [...p] as RoutePoint)
    for (let i = 1; i < path.length - 1; i++) {
      const incoming = new Vector3(...path[i]!).sub(new Vector3(...path[i - 1]!)).normalize()
      const outgoing = new Vector3(...path[i + 1]!).sub(new Vector3(...path[i]!)).normalize()
      const z = outgoing.clone().addScaledVector(incoming, -incoming.dot(outgoing)).normalize()
      const y = z.clone().cross(incoming).normalize()
      const rotation = new Euler().setFromRotationMatrix(new Matrix4().makeBasis(incoming, y, z))
      const fitting = PipeFittingNode.parse({ ...elbow, id: undefined, name: 'Pool insertion elbow', position: path[i], rotation: [rotation.x, rotation.y, rotation.z], angle: Math.min(90, Math.acos(Math.max(-1, Math.min(1, incoming.dot(outgoing)))) * 180 / Math.PI) })
      const ports = fittingPorts(fitting)
      ends[i - 1] = [...ports.find(p => p.id === 'inlet')!.position]
      starts[i] = [...ports.find(p => p.id === 'outlet')!.position]
      members.push(fitting)
    }
    starts.forEach((p, i) => members.push(PipeSegmentNode.parse({ name: 'Pool insertion pipe', diameter: run.diameter, pipeMaterial: run.pipeMaterial, system: run.system, path: [p, ends[i]!] })))
  }
  return {
    equipment,
    update: { id: run.id, data: { path: [...run.path.slice(0, index + 1), cuts[0]!] } },
    tail: PipeSegmentNode.parse({ ...run, id: undefined, path: [cuts[1]!, ...run.path.slice(index + 1)] }),
    members,
  }
}
