import { afterEach, expect, test } from 'bun:test'
import { useScene, type AnyNode } from '@pascal-app/core'
import { Vector3 } from 'three'
import { poolOutlineDistance } from './pool-pipe-outline'
import { nativeFittingPorts } from '../../tests/pipe-fitting-ports'
import { PoolNode } from '../core/schema'
import { POOL_SHAPES, DEFAULT_POOL_SHAPE_DIMENSIONS, createPoolShapePolygon, sampleClosedPoolSpline } from './shapes'
import { poolDrainDefinition } from '../drain/core/definition'
import { poolSkimmerDefinition } from '../skimmer/core/definition'
import { poolInletDefinition } from '../inlet/core/definition'
import { runtimeConnections } from '../core/runtime-connections'
import { createDefaultPoolAttachments } from './default-pool-attachments'
import { DEFAULT_POOL_PIPE_OPTIONS, planPoolPipes, type PoolPipeCircuit } from './pool-pipe-layout'

const before = useScene.getState()
afterEach(() => useScene.setState(before))


function setup(rotation = 0, position = [0, 0, 0], circuit: PoolPipeCircuit = 'inlets') {
  const pool = PoolNode.parse({ rotation: [0, rotation, 0], position })
  useScene.setState({ nodes: { [pool.id]: pool } as unknown as Record<AnyNode['id'], AnyNode> })
  const ports = createDefaultPoolAttachments(pool).flatMap((node) => {
    if (circuit === 'inlets' && node.type === 'pool:inlet') return poolInletDefinition.ports!(node)
    if (circuit === 'skimmers' && node.type === 'pool:skimmer') return poolSkimmerDefinition.ports!(node)
    if (circuit === 'drains' && node.type === 'pool:drain') return poolDrainDefinition.ports!(node)
    return []
  })
  return { pool, ports }
}

for (const circuit of ['inlets', 'skimmers', 'drains'] as const) for (const exitCorner of [0, 1, 2, 3]) for (const rotation of [0, Math.PI / 4]) for (const drop of [0, 0.5]) {
  test(`all ${circuit} sockets join one open end: corner ${exitCorner}, rotation ${rotation}, drop ${drop}`, () => {
    const { pool, ports } = setup(rotation, [12, 2, -7], circuit)
    const plan = planPoolPipes(pool, ports, { ...DEFAULT_POOL_PIPE_OPTIONS, circuit, exitCorner, drop }, nativeFittingPorts)
    expect(ports.length).toBeGreaterThan(1)
    if (circuit === 'skimmers') {
      for (const port of ports) {
        const pipe = plan.pipes.find((node) => node.path.some((point) => new Vector3(...point).distanceTo(new Vector3(...port.position)) < 1e-6))!
        const other = pipe.path.find((point) => new Vector3(...point).distanceTo(new Vector3(...port.position)) > 1e-6)!
        expect(other[0]).toBeCloseTo(port.position[0])
        expect(other[2]).toBeCloseTo(port.position[2])
        expect(other[1]).toBeLessThan(port.position[1])
      }
      const belowOutlet = Math.min(...ports.map((port) => port.position[1])) - plan.freeEnd[1] - drop
      expect(belowOutlet).toBeGreaterThan(0.1)
      expect(belowOutlet).toBeLessThan(0.14)
    }
    const nodes = [
      ...ports.map((port, i) => ({ id: `inlet${i}`, type: 'pool:inlet', levelId: 'level', ports: [port] })),
      ...plan.fittings.map((node) => ({ id: node.id, type: node.type, levelId: 'level', ports: nativeFittingPorts(node) })),
      ...plan.pipes.map((node) => ({ id: node.id, type: node.type, levelId: 'level', ports: node.path.map((point, i) => ({ id: String(i), position: point, direction: new Vector3(...point).sub(new Vector3(...node.path[1 - i]!)).normalize().toArray(), diameter: node.diameter, system: node.system })) })),
    ]
    const graph = runtimeConnections(nodes)
    expect(graph.connectedTo('inlet0', ports[0]!.id)).toHaveLength(ports.length - 1)
    const freePorts = nodes.flatMap((node) => node.ports.filter((port) => !graph.isOccupied(node.id, port.id)))
    expect(freePorts).toHaveLength(1)
    expect(freePorts[0]!.position).toEqual(plan.freeEnd)
    for (const node of nodes) for (const port of node.ports) {
      const mates = nodes.filter((other) => other.id !== node.id).flatMap((other) => other.ports).filter((other) => new Vector3(...port.position).distanceTo(new Vector3(...other.position)) < 1e-6)
      if (mates.length) {
        expect(mates).toHaveLength(1)
        expect(new Vector3(...port.direction).dot(new Vector3(...mates[0]!.direction))).toBeCloseTo(-1)
      }
    }
    expect(plan.fittings.filter((node) => node.fittingType === 'sanitary-tee')).toHaveLength(ports.length - 1)
    for (const [a, b] of plan.preview) {
      if (circuit === 'drains') {
        if (Math.abs(a[1] - b[1]) < 1e-6) expect(a[1]).toBeLessThan(-pool.depth - pool.floorThickness)
        continue
      }
      const midpoint = new Vector3(...a).lerp(new Vector3(...b), 0.5)
      expect(Math.abs(midpoint.x) >= pool.length / 2 || Math.abs(midpoint.z) >= pool.width / 2).toBe(true)
    }
  })
}

test('one inlet creates a route without an unused tee socket', () => {
  const { pool, ports } = setup()
  const plan = planPoolPipes(pool, ports.slice(0, 1), DEFAULT_POOL_PIPE_OPTIONS, nativeFittingPorts)
  expect(plan.fittings.every((node) => node.fittingType === 'elbow')).toBe(true)
})

test('rejects invalid outlines, mixed diameters, duplicate inlets and insufficient fitting space', () => {
  const { pool, ports } = setup()
  const plan = (next = pool, sockets = ports, options = DEFAULT_POOL_PIPE_OPTIONS) => planPoolPipes(next, sockets, options, nativeFittingPorts)
  expect(() => plan({ ...pool, polygon: [[0, 0], [2, 2], [0, 2], [2, 0]] })).toThrow('valid closed polygon')
  expect(() => plan(pool, [])).toThrow('Add inlets')
  expect(() => plan(pool, [ports[0]!, { ...ports[1]!, diameter: 4 }])).toThrow('matching')
  expect(() => plan(pool, [ports[0]!, ports[0]!])).toThrow()
  expect(() => plan(pool, ports, { ...DEFAULT_POOL_PIPE_OPTIONS, drop: 0.01 })).toThrow('enough room')
  expect(() => plan(pool, ports, { ...DEFAULT_POOL_PIPE_OPTIONS, clearance: NaN })).toThrow()
  expect(() => plan(pool, ports, { ...DEFAULT_POOL_PIPE_OPTIONS, clearance: 0.21 })).toThrow('clear of the shell')
  expect(() => plan(pool, ports, { ...DEFAULT_POOL_PIPE_OPTIONS, clearance: 0.4, drop: 0.5 })).toThrow()
})

test('skimmer run height follows outlets instead of pool floor depth', () => {
  const { pool, ports } = setup(0, [0, 0, 0], 'skimmers')
  const options = { ...DEFAULT_POOL_PIPE_OPTIONS, circuit: 'skimmers' as const }
  const original = planPoolPipes(pool, ports, options, nativeFittingPorts)
  const deeper = planPoolPipes({ ...pool, depth: 4 }, ports, options, nativeFittingPorts)
  const lowered = planPoolPipes(pool, ports, { ...options, drop: 0.4 }, nativeFittingPorts)
  expect(deeper.freeEnd[1]).toBeCloseTo(original.freeEnd[1])
  expect(lowered.freeEnd[1]).toBeCloseTo(original.freeEnd[1] - 0.4)
  expect(() => planPoolPipes({ ...pool, shellThickness: 0.3 }, ports, options, nativeFittingPorts)).toThrow('clear of the shell')
})

test('aligned and scattered drains join beneath a sloped floor with one free end', () => {
  const pool = PoolNode.parse({ floorProfile: 'shallow-to-deep', deepDepth: 3 })
  const options = { ...DEFAULT_POOL_PIPE_OPTIONS, circuit: 'drains' as const }
  for (const positions of [ [[0, -1.2, 0]], [[-1, -1.2, -1], [-1, -1.2, 1], [1, -3.1, -1], [1, -3.1, 1]] ]) {
    const ports = positions.map((p) => ({ id: 'suction', position: p as [number, number, number], direction: [0, -1, 0] as const, diameter: 2, system: 'waste' as const }))
    const plan = planPoolPipes(pool, ports, options, nativeFittingPorts)
    expect(plan.freeEnd[1]).toBeLessThan(-3.2)
    expect(plan.fittings.filter((node) => node.fittingType === 'sanitary-tee')).toHaveLength(ports.length - 1)
    const nodes = [
      ...ports.map((port, i) => ({ id: `drain${i}`, type: 'pool:drain', levelId: 'level', ports: [port] })),
      ...plan.fittings.map((node) => ({ id: node.id, type: node.type, levelId: 'level', ports: nativeFittingPorts(node) })),
      ...plan.pipes.map((node) => ({ id: node.id, type: node.type, levelId: 'level', ports: node.path.map((position, i) => ({ id: String(i), position, direction: new Vector3(...position).sub(new Vector3(...node.path[1 - i]!)).normalize().toArray(), diameter: node.diameter, system: node.system })) })),
    ]
    const graph = runtimeConnections(nodes)
    expect(graph.connectedTo('drain0', 'suction')).toHaveLength(ports.length - 1)
    expect(nodes.flatMap((node) => node.ports.filter((port) => !graph.isOccupied(node.id, port.id)))).toHaveLength(1)
    expect(() => planPoolPipes(pool, [{ ...ports[0]!, direction: [1, 0, 0] }], options, nativeFittingPorts)).toThrow('downward')
    expect(() => planPoolPipes(pool, [ports[0]!, ports[0]!], options, nativeFittingPorts)).toThrow()
  }
})

for (const shape of POOL_SHAPES) for (const defaults of [false, true]) for (const circuit of ['inlets', 'skimmers', 'drains'] as const) for (const exitCorner of [0, 1, 2, 3]) {
  test(`${shape} ${circuit} join at exit ${exitCorner}, defaults ${defaults}`, () => {
    const { length, width } = defaults ? DEFAULT_POOL_SHAPE_DIMENSIONS[shape] : { length: 8, width: 6 }
    const polygon = shape === 'custom' ? [[-4, -3], [4, -2], [2, 3], [-3, 2]] as [number, number][]
      : shape === 'spline' ? sampleClosedPoolSpline([[-4, -2], [0, -3], [4, -1], [2, 3], [-3, 2]])
      : createPoolShapePolygon(shape, length, width)
    const pool = PoolNode.parse({ shape, polygon: defaults ? [...polygon].reverse() : polygon, length, width, rotation: [0, 0.37, 0], position: [12, 2, -7], floorProfile: 'shallow-to-deep', deepDepth: 3 })
    useScene.setState({ nodes: { [pool.id]: pool } as unknown as Record<AnyNode['id'], AnyNode> })
    const ports = createDefaultPoolAttachments(pool).flatMap((node) => {
      if (circuit === 'inlets' && node.type === 'pool:inlet') return poolInletDefinition.ports!(node)
      if (circuit === 'skimmers' && node.type === 'pool:skimmer') return poolSkimmerDefinition.ports!(node)
      if (circuit === 'drains' && node.type === 'pool:drain') return poolDrainDefinition.ports!(node)
      return []
    })
    const plan = planPoolPipes(pool, ports, { ...DEFAULT_POOL_PIPE_OPTIONS, circuit, exitCorner }, nativeFittingPorts)
    const nodes = [
      ...ports.map((port, i) => ({ id: `source${i}`, type: 'pool:inlet', levelId: 'level', ports: [port] })),
      ...plan.fittings.map((node) => ({ id: node.id, type: node.type, levelId: 'level', ports: nativeFittingPorts(node) })),
      ...plan.pipes.map((node) => ({ id: node.id, type: node.type, levelId: 'level', ports: node.path.map((position, i) => ({ id: String(i), position, direction: new Vector3(...position).sub(new Vector3(...node.path[1 - i]!)).normalize().toArray(), diameter: node.diameter, system: node.system })) })),
    ]
    for (const [a, b] of plan.preview) for (let i = 0; i <= 20; i++) {
      const point = new Vector3(...a).lerp(new Vector3(...b), i / 20)
      if (circuit === 'drains') {
        if (Math.abs(a[1] - b[1]) < 1e-6) expect(point.y).toBeLessThan(-pool.deepDepth - pool.floorThickness)
      } else if (point.y >= -pool.deepDepth - pool.floorThickness) expect(poolOutlineDistance(point, polygon)).toBeGreaterThanOrEqual(-1e-6)
    }
    const graph = runtimeConnections(nodes)
    expect(graph.connectedTo('source0', ports[0]!.id)).toHaveLength(ports.length - 1)
    const free = nodes.flatMap((node) => node.ports.filter((port) => !graph.isOccupied(node.id, port.id)))
    expect(free).toHaveLength(1)
    expect(new Vector3(...free[0]!.position).distanceTo(new Vector3(...plan.freeEnd))).toBeLessThan(1e-6)
    for (const node of nodes) for (const port of node.ports) {
      const mates = nodes.filter((other) => other.id !== node.id).flatMap((other) => other.ports).filter((other) => new Vector3(...port.position).distanceTo(new Vector3(...other.position)) < 1e-6)
      if (mates.length) {
        expect(mates).toHaveLength(1)
        expect(new Vector3(...port.direction).dot(new Vector3(...mates[0]!.direction))).toBeCloseTo(-1)
      }
    }
  })
}
