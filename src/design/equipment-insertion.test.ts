import { expect, test } from 'bun:test'
import { LevelNode, PipeSegmentNode, useScene, type AnyNode, type PipeFittingNode } from '@pascal-app/core'
import { Box3, Euler, Matrix4, Vector3 } from 'three'
import { PoolPumpNode } from '../pump/core/schema'
import { PoolFilterNode } from '../filter/core/schema'
import { PoolHeaterNode } from '../heater/core/schema'
import { buildPumpGeometry } from '../pump/core/geometry'
import { buildFilterGeometry } from '../filter/core/geometry'
import { buildHeaterGeometry } from '../heater/core/geometry'
import { disposeObject3D } from '../editor/dispose-object'
import { connectionPorts } from '../core/connection-ports'
import { equipmentPortsLocal, planEquipmentInsertion, planEquipmentInsertionAsync } from './equipment-insertion'
import { routePipe, segmentHitsBox } from './pipe-route'

function ports(node: PipeFittingNode) {
  const leg = Math.max(0.07, node.diameter * 0.0254 * 1.1)
  return [{ id: 'inlet', direction: [-1, 0, 0] }, { id: 'outlet', direction: [Math.cos(node.angle * Math.PI / 180), 0, Math.sin(node.angle * Math.PI / 180)] }].map(p => {
    const direction = new Vector3(...p.direction).applyEuler(new Euler(...node.rotation))
    return { id: p.id, direction: direction.toArray(), position: direction.clone().multiplyScalar(leg).add(new Vector3(...node.position)).toArray(), diameter: node.diameter, system: node.system }
  })
}
const fixtures = [
  { node: PoolPumpNode.parse({}), geometry: buildPumpGeometry(PoolPumpNode.parse({})) },
  { node: PoolFilterNode.parse({}), geometry: buildFilterGeometry(PoolFilterNode.parse({})) },
  { node: PoolHeaterNode.parse({}), geometry: buildHeaterGeometry(PoolHeaterNode.parse({})) },
]
for (const { node, geometry } of fixtures) {
  const bounds = new Box3().setFromObject(geometry)
  disposeObject3D(geometry)
  test(`${node.type} keeps unobstructed insertion cuts reasonably close to the equipment`, () => {
    const run = PipeSegmentNode.parse({ path: [[-6, 0, 0], [6, 0, 0]], diameter: 2 })
    const plan = planEquipmentInsertion(run, 0, [0, 0, 0], node, bounds, ports)!
    expect(plan).not.toBeNull()
    const bodyHalf = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))
    for (const cut of [plan.update.data.path!.at(-1)!, plan.tail.path[0]!]) {
      const clearance = Math.abs(cut[0]) - bodyHalf
      expect(clearance).toBeGreaterThanOrEqual(0.2)
      expect(clearance).toBeLessThanOrEqual(0.7)
    }
    for (const pipe of plan.members.filter(member => member.type === 'pipe-segment')) {
      expect(new Vector3(...pipe.path[0]!).distanceTo(new Vector3(...pipe.path[1]!))).toBeGreaterThanOrEqual(0.05 - 1e-6)
    }
  })
  test(`${node.type} async routing matches synchronous geometry and propagates cancellation`, async () => {
    const run = PipeSegmentNode.parse({ path: [[-1.5, 0.0254, 2.5], [3.5, 0.0254, 1.5]], diameter: 2 })
    const args: Parameters<typeof planEquipmentInsertion> = [run, 0, [1, 0.0254, 2], node, bounds, ports]
    const sync = planEquipmentInsertion(...args)!
    const asyncPlan = (await planEquipmentInsertionAsync(args, async request => routePipe(...structuredClone(request))))!
    expect(asyncPlan.update).toEqual(sync.update)
    expect(asyncPlan.tail.path).toEqual(sync.tail.path)
    expect(asyncPlan.equipment).toEqual(sync.equipment)
    expect(asyncPlan.members.map(({ id, ...member }) => member)).toEqual(sync.members.map(({ id, ...member }) => member))
    await expect(planEquipmentInsertionAsync(args, async () => { throw new Error('cancelled') })).rejects.toThrow('cancelled')
  })
  test(`${node.type} connects on the browser reproduction pipe`, () => {
    const run = PipeSegmentNode.parse({ path: [[-1.5, 0.0254, 2.5], [3.5, 0.0254, 1.5]], diameter: 2 })
    const plan = planEquipmentInsertion(run, 0, [1, 0.0254, 2], node, bounds, ports)
    expect(plan).not.toBeNull()
    if (node.type === 'pool:heater') {
      for (const member of plan!.members) for (const point of member.type === 'pipe-segment' ? member.path : [member.position]) expect(point[1]).toBeLessThanOrEqual(0.538001)
      const pipes = plan!.members.filter(member => member.type === 'pipe-segment')
      const length = pipes.reduce((sum, pipe) => sum + new Vector3(...pipe.path[0]!).distanceTo(new Vector3(...pipe.path[1]!)), 0)
      expect(length).toBeLessThan(5)
      expect(plan!.members.filter(member => member.type === 'pipe-fitting').length).toBeLessThanOrEqual(11)
    }
  })
  for (const angle of [0.17, 0.52, 1.1]) test(`${node.type} connects to pipe angle ${angle} without rotation`, () => {
    const dx = 4 * Math.cos(angle), dz = 4 * Math.sin(angle)
    const run = PipeSegmentNode.parse({ path: [[-dx, 0, -dz], [dx, 0, dz]], diameter: 2 })
    const plan = planEquipmentInsertion(run, 0, [0, 0, 0], node, bounds, ports)
    expect(plan).not.toBeNull()
    expect(plan!.equipment.rotation).toEqual(node.rotation)
  })
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const diagonal of [false, true]) {
    test(`${node.type} preserves yaw ${yaw} on ${diagonal ? 'diagonal' : 'straight'} pipe`, () => {
      const run = PipeSegmentNode.parse({ path: [[-10, 0, diagonal ? -10 : 0], [10, 0, diagonal ? 10 : 0]], diameter: 2 })
      const rotated = { ...node, rotation: [0, yaw, 0] as [number, number, number] }
      const plan = planEquipmentInsertion(run, 0, [0, 0, 0], rotated, bounds, ports)
      expect(plan).not.toBeNull()
      expect(plan!.equipment.rotation).toEqual(rotated.rotation)
      const endpoints = plan!.members.flatMap(member => member.type === 'pipe-segment' ? member.path : [])
      for (const member of plan!.members) {
        const points = member.type === 'pipe-segment' ? member.path : [member.position, ...ports(member).map(port => port.position)]
        for (const point of points) expect(point[1]).toBeGreaterThanOrEqual(-1e-6)
      }
      for (const socket of connectionPorts(plan!.equipment, equipmentPortsLocal(plan!.equipment)).filter(port => ['inlet', 'outlet'].includes(port.id))) {
        expect(endpoints.some(point => new Vector3(...point).distanceTo(new Vector3(...socket.position)) < 1e-6)).toBe(true)
      }
    })
  }
  if (node.type === 'pool:heater') test('heater connections never detour below a ground-level run', () => {
    const run = PipeSegmentNode.parse({ path: [[-6, 0, 0], [6, 0, 0]], diameter: 2 })
    const plan = planEquipmentInsertion(run, 0, [0, 0, 0], node, bounds, ports)
    expect(plan).not.toBeNull()
    for (const member of plan!.members) {
      const points = member.type === 'pipe-segment' ? member.path : ports(member).map(port => port.position)
      for (const point of points) expect(point[1]).toBeGreaterThanOrEqual(-1e-6)
    }
  })
  test(`${node.type} respects a user half-turn when planning insertion`, () => {
    const run = PipeSegmentNode.parse({ path: [[-10, 0, 0], [10, 0, 0]], diameter: 2 })
    const rotated = { ...node, rotation: [0, Math.PI, 0] as [number, number, number] }
    const plan = planEquipmentInsertion(run, 0, [0, 0, 0], rotated, bounds, ports)
    expect(plan).not.toBeNull()
    expect(plan!.equipment.rotation).toEqual(rotated.rotation)
  })
  if (node.type === 'pool:heater') for (const length of [2, 3, 4]) test(`heater insertion on a ${length}m pipe`, () => {
    const run = PipeSegmentNode.parse({ path: [[-length / 2, 0, 0], [length / 2, 0, 0]], diameter: 2 })
    const template = node
    const plan = planEquipmentInsertion(run, 0, [0, 0, 0], template, bounds, ports)
    expect(plan).not.toBeNull()
    expect(plan!.equipment.rotation).toEqual(template.rotation)
    const points = plan!.members.flatMap(member => member.type === 'pipe-segment' ? member.path : [])
    for (const point of points) expect(point[1]).toBeGreaterThanOrEqual(-1e-6)
    for (const socket of connectionPorts(plan!.equipment, equipmentPortsLocal(plan!.equipment)).filter(port => ['inlet', 'outlet'].includes(port.id))) {
      expect(points.some(point => new Vector3(...point).distanceTo(new Vector3(...socket.position)) < 1e-6)).toBe(true)
    }
  })
  test(`${node.type} handles rotated runs, rejects short/blocked runs, and undoes the complete assembly`, () => {
    const level = LevelNode.parse({ children: [] })
    const run = PipeSegmentNode.parse({ parentId: level.id, path: [[-6, 0, -6], [6, 0, 6]], diameter: 2 })
    const plan = planEquipmentInsertion(run, 0, [0, 0, 0], node, bounds, ports)!
    expect(plan).not.toBeNull()
    expect(planEquipmentInsertion({ ...run, path: [[-0.5, 0, 0], [0.5, 0, 0]] }, 0, [0, 0, 0], node, bounds, ports)).toBeNull()
    expect(planEquipmentInsertion(run, 0, [0, 0, 0], node, bounds, ports, [{ min: [-20, -20, -20], max: [20, 20, 20] }])).toBeNull()
    const original = useScene.getState()
    useScene.setState({ nodes: { [level.id]: { ...level, children: [run.id] }, [run.id]: run }, rootNodeIds: [level.id], readOnly: false })
    useScene.temporal.getState().clear()
    useScene.temporal.getState().resume()
    try {
      useScene.getState().applyNodeChanges({ update: [plan.update], create: [plan.equipment as unknown as AnyNode, plan.tail, ...plan.members].map(member => ({ node: member, parentId: level.id })) })
      expect(useScene.getState().nodes[plan.tail.id]).toBeDefined()
      expect(useScene.getState().nodes[plan.equipment.id as never]).toBeDefined()
      useScene.temporal.getState().undo()
      expect(useScene.getState().nodes[run.id]).toEqual(run)
      expect(Object.keys(useScene.getState().nodes)).toHaveLength(2)
      useScene.temporal.getState().redo()
      expect(useScene.getState().nodes[plan.equipment.id as never]).toBeDefined()
    } finally { useScene.setState(original); useScene.temporal.getState().clear() }
  })
  for (const slope of [0, 0.02]) test(`${node.type} inserts with slope ${slope} and exact elbow collars`, () => {
    const run = PipeSegmentNode.parse({ path: [[-6, 0, 0], [6, -12 * slope, 0]], diameter: 2 })
    const plan = planEquipmentInsertion(run, 0, [0, 0, 0], node, bounds, ports)
    expect(plan).not.toBeNull()
    if (!plan) return
    const pipes = plan.members.filter(n => n.type === 'pipe-segment')
    const footprint = bounds.clone().applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(...plan.equipment.rotation)).setPosition(...plan.equipment.position))
    const underneath = { min: [footprint.min.x, -Infinity, footprint.min.z] as [number, number, number], max: [footprint.max.x, footprint.min.y - 1e-5, footprint.max.z] as [number, number, number] }
    for (const pipe of pipes) expect(segmentHitsBox(pipe.path[0]!, pipe.path[1]!, underneath)).toBe(false)
    const points = [...pipes.flatMap(n => n.path), ...plan.update.data.path!, ...plan.tail.path]
    const matches = (p: readonly number[]) => points.some(q => new Vector3(...q).distanceTo(new Vector3(...p)) < 1e-6)
    const equipmentPorts = connectionPorts(plan.equipment, equipmentPortsLocal(plan.equipment))
    for (const port of equipmentPorts.filter(p => ['inlet', 'outlet'].includes(p.id))) expect(matches(port.position)).toBe(true)
    for (const fitting of plan.members.filter(n => n.type === 'pipe-fitting')) for (const port of ports(fitting)) expect(matches(port.position)).toBe(true)
    expect(matches(plan.update.data.path!.at(-1)!)).toBe(true)
    expect(matches(plan.tail.path[0]!)).toBe(true)
    expect(run.path).toEqual([[-6, 0, 0], [6, -12 * slope, 0]])
  })
}
