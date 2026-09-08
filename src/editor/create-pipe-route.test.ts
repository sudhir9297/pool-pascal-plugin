import { afterEach, expect, spyOn, test } from 'bun:test'
import { LevelNode, nodeRegistry, sceneRegistry, useScene, type AnyNode, type PipeFittingNode } from '@pascal-app/core'
import { BoxGeometry, Euler, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { PoolHeaterNode } from '../heater/core/schema'
import { createPipeRoute } from './create-pipe-route'

const original = useScene.getState().nodes
afterEach(() => useScene.setState({ nodes: original }))

test.each(['baseline', 'hidden equipment', 'unrendered helper', 'missing endpoint'])('route creation handles %s', (scenario) => {
  const level = LevelNode.parse({})
  const source = PoolHeaterNode.parse({ parentId: level.id })
  const target = PoolHeaterNode.parse({ parentId: level.id, position: [3, 1, 0] })
  useScene.setState({ nodes: { [level.id]: level, [source.id]: source, [target.id]: target } as Record<AnyNode['id'], AnyNode> })
  if (scenario === 'hidden equipment' || scenario === 'unrendered helper') {
    const extra = scenario === 'hidden equipment'
      ? PoolHeaterNode.parse({ parentId: level.id, visible: false })
      : { id: 'helper_test', type: 'pool:shared-joint', parentId: level.id, visible: true }
    useScene.setState({ nodes: { ...useScene.getState().nodes, [extra.id]: extra } as Record<AnyNode['id'], AnyNode> })
  }
  const ports = (node: PipeFittingNode) => {
    const leg = Math.max(0.07, node.diameter * 0.0254 * 1.1)
    const angle = node.angle * Math.PI / 180
    return [{ id: 'inlet', direction: [-1, 0, 0] }, { id: 'outlet', direction: [Math.cos(angle), 0, Math.sin(angle)] }].map((p) => {
      const direction = new Vector3(...p.direction).applyEuler(new Euler(...node.rotation))
      return { id: p.id, direction: direction.toArray(), position: direction.clone().multiplyScalar(leg).add(new Vector3(...node.position)).toArray(), diameter: node.diameter, system: node.system }
    })
  }
  const registry = spyOn(nodeRegistry, 'get').mockImplementation((kind) => (kind === 'pipe-fitting' ? { ports } : {}) as never)
  const group = new Group()
  const geometry = new BoxGeometry(0.4, 0.4, 0.4)
  const material = new MeshBasicMaterial()
  const a = new Mesh(geometry, material), b = new Mesh(geometry, material)
  b.position.set(3, 1, 0); group.add(a, b)
  const lookup = spyOn(sceneRegistry.nodes, 'get').mockImplementation((id) => id === level.id ? group : id === source.id ? a : id === target.id && scenario !== 'missing endpoint' ? b : undefined)
  const commit = spyOn(useScene.getState(), 'applyNodeChanges').mockImplementation(() => {})
  try {
    if (scenario === 'missing endpoint') {
      expect(() => createPipeRoute(source as unknown as AnyNode, { id: 'outlet', position: [0.3, 0, 0], direction: [1, 0, 0], diameter: 2, system: 'waste' }, target as unknown as AnyNode, { id: 'inlet', position: [3.3, 1, 0], direction: [1, 0, 0], diameter: 2, system: 'waste' })).toThrow(target.id)
      expect(commit).not.toHaveBeenCalled()
      return
    }
    const result = createPipeRoute(source as unknown as AnyNode, { id: 'outlet', position: [0.3, 0, 0], direction: [1, 0, 0], diameter: 2, system: 'waste' }, target as unknown as AnyNode, { id: 'inlet', position: [3.3, 1, 0], direction: [1, 0, 0], diameter: 2, system: 'waste' })
    expect(result.elbows).toBeGreaterThan(0)
    expect(commit).toHaveBeenCalledTimes(1)
    const created = commit.mock.calls[0]![0].create!
    for (const { node } of created) {
      expect(node.metadata).not.toHaveProperty('poolConnection')
    }
    const pipes = created.flatMap(({ node }) => node.type === 'pipe-segment' ? [node] : [])
    const fittings = created.flatMap(({ node }) => node.type === 'pipe-fitting' ? [node] : [])
    expect(new Set(created.map(({ node }) => node.id)).size).toBe(created.length)
    for (const fitting of fittings) for (const port of ports(fitting)) {
      expect(pipes.some((pipe) => pipe.path.some((point) => new Vector3(...point).distanceTo(new Vector3(...port.position)) < 1e-6))).toBe(true)
    }
    expect(pipes[0]!.path[0]).toEqual([0.3, 0, 0])
    expect(pipes.at(-1)!.path.at(-1)![0]).toBeCloseTo(3.3)
  } finally { registry.mockRestore(); lookup.mockRestore(); commit.mockRestore(); geometry.dispose(); material.dispose() }
})
