import { describe, expect, test } from 'bun:test'
import { useScene, type AnyNode } from '@pascal-app/core'
import { PoolNode } from '../core/schema'
import { getPoolDrainPlacement } from '../drain/design/pool-placement'
import { poolParametrics } from '../editor/parametrics'
import { createPoolPluginNode } from '../editor/scene-nodes'
import { createDefaultPoolAttachments } from './default-pool-attachments'
import { poolAttachmentUpdates, resolvePoolAttachment } from './pool-attachments'
import { createPoolShapePolygon } from './shapes'
import { planPoolFittings, POOL_FITTING_RULES } from './pool-fitting-layout'
import { syncAutomaticPoolFittings } from './sync-pool-fittings'
import { PoolInletNode } from '../inlet/core/schema'

function resized(pool: PoolNode, length: number, width: number) {
  const patch = { length, width }
  const next = { ...pool, ...patch }
  return PoolNode.parse({ ...next, ...poolParametrics.derive!(next, patch) })
}
function apply(nodes: Record<string, unknown>) {
  const changes = syncAutomaticPoolFittings(nodes)
  const next = { ...nodes }
  for (const node of changes.create) next[node.id] = node
  for (const update of changes.update) next[update.id] = { ...next[update.id] as object, ...update.data }
  for (const id of changes.delete) delete next[id]
  return next
}

describe('automatic pool fittings', () => {
  test('generated fittings keep manually chosen anchors during sync and resize', () => {
    const pool = PoolNode.parse({ automaticFittings: true })
    const children = createDefaultPoolAttachments(pool).map(node => {
      if (node.type === 'pool:drain') return { ...node, floorAnchor: [0.3, 0.6] as [number, number] }
      if ('wallT' in node) return { ...node, wallIndex: 2, wallT: 0.3 }
      return node
    })
    for (const host of [pool, resized(pool, 16, 8)]) {
      const nodes = apply(Object.fromEntries([host, ...children].map(node => [node.id, node])))
      for (const child of children) {
        const result = nodes[child.id] as typeof child
        if (child.type === 'pool:drain') expect(result).toMatchObject({ floorAnchor: [0.3, 0.6] })
        else if ('wallT' in child) expect(result).toMatchObject({ wallIndex: 2, wallT: 0.3 })
      }
      expect(syncAutomaticPoolFittings(nodes)).toEqual({ create: [], update: [], delete: [] })
    }
  })
  test('creates dimension-based fittings in one scene operation', () => {
    const before = useScene.getState()
    try {
      const operations: unknown[] = []
      useScene.setState({ applyNodeChanges: (change) => { operations.push(change) } })
      const pool = PoolNode.parse({ parentId: 'level_test' })
      createPoolPluginNode(pool, 'level_test')
      expect(operations).toHaveLength(1)
      const changes = operations[0] as { create: { node: AnyNode; parentId: string }[] }
      const types = changes.create.map(({ node }) => node.type as string)
      expect(types.filter((type) => type === 'pool:skimmer')).toHaveLength(2)
      expect(types.filter((type) => type === 'pool:inlet')).toHaveLength(4)
      expect(types.filter((type) => type === 'pool:drain')).toHaveLength(2)
      expect(types.filter((type) => type === 'pool:stair')).toHaveLength(1)
      expect(changes.create.slice(1).every(({ parentId }) => parentId === pool.id)).toBe(true)
      expect(PoolNode.parse(changes.create[0]!.node).automaticFittings).toBe(true)
    } finally { useScene.setState(before) }
  })

  test('resizing updates existing slots without adding missing fittings, then settles', () => {
    const pool = PoolNode.parse({ automaticFittings: true })
    const children = createDefaultPoolAttachments(pool)
    const custom = resolvePoolAttachment(PoolInletNode.parse({ poolId: pool.id, parentId: pool.id }), pool)!
    const edited = { ...children[0]!, name: 'My skimmer', showFlow: true }
    const large = resized(pool, 20, 12)
    const nodes = Object.fromEntries([large, ...children.slice(1), edited, custom].map((node) => [node.id, node]))
    const grown = apply(nodes)
    expect(Object.values(grown).filter((node) => (node as { type: string }).type === 'pool:skimmer')).toHaveLength(2)
    expect(Object.values(grown).filter((node) => (node as { type: string }).type === 'pool:drain')).toHaveLength(2)
    expect(grown[edited.id]).toMatchObject({ name: 'My skimmer', showFlow: true })
    expect(grown[custom.id]).toEqual(custom)
    expect(syncAutomaticPoolFittings(grown)).toEqual({ create: [], update: [], delete: [] })
    const shrunk = apply({ ...grown, [pool.id]: pool })
    expect(Object.keys(shrunk)).toHaveLength(children.length + 2)
    expect(shrunk[custom.id]).toEqual(custom)
    expect(poolAttachmentUpdates(shrunk)).toEqual([])
  })

  test('manual mode and older scenes do not generate or delete fittings', () => {
    const pool = PoolNode.parse({})
    const children = createDefaultPoolAttachments(pool)
    const nodes = Object.fromEntries([resized(pool, 20, 10), ...children].map((node) => [node.id, node]))
    expect(syncAutomaticPoolFittings(nodes)).toEqual({ create: [], update: [], delete: [] })
  })

  test('drain count follows flow capacity with one outlet unavailable', () => {
    const pool = PoolNode.parse({})
    for (const flow of [13, 13.01, 26, 26.01, 52]) {
      const plan = planPoolFittings({ ...pool, fittingFlowRate: flow })
      expect((plan.counts.drain - 1) * pool.drainFlowCapacity).toBeGreaterThanOrEqual(flow)
    }
    expect(planPoolFittings({ ...pool, fittingFlowRate: 26 }).counts.drain).toBe(3)
    expect(planPoolFittings({ ...pool, fittingFlowRate: 26.01 }).counts.drain).toBe(4)
  })

  test('area thresholds use the actual outline rather than its bounding box', () => {
    const pool = PoolNode.parse({})
    expect(planPoolFittings(resized(pool, 5, 5)).counts.skimmer).toBe(1)
    expect(planPoolFittings(resized(pool, 5.01, 5)).counts.skimmer).toBe(2)
    const concave = PoolNode.parse({ polygon: [[0,0], [8,0], [8,1], [1,1], [1,6], [0,6]] })
    expect(planPoolFittings(concave).area).toBe(13)
    expect(planPoolFittings(concave).counts.skimmer).toBe(1)
  })

  test('drains stay inside outlines, at floor depth, and at least three feet apart', () => {
    const outlines = [
      ...(['rectangle', 'kidney', 'lagoon', 'roman', 'l-shape'] as const).map((shape) => createPoolShapePolygon(shape, 8, 6)),
      [[0, 0], [8, 0], [8, 1], [1, 1], [1, 6], [0, 6]] as [number, number][],
    ]
    for (const polygon of outlines) {
      const pool = PoolNode.parse({ polygon, floorProfile: 'shallow-to-deep' })
      const children = createDefaultPoolAttachments(pool)
      const drains = children.filter((node) => node.type === 'pool:drain')
      expect(drains.length).toBeGreaterThanOrEqual(2)
      for (const drain of drains) {
        const placement = getPoolDrainPlacement(pool, drain.position)
        expect(placement).not.toBeNull()
        expect(placement!.position[1]).toBeCloseTo(drain.position[1], 8)
        for (const other of drains) if (other !== drain) {
          expect(Math.hypot(drain.position[0] - other.position[0], drain.position[2] - other.position[2])).toBeGreaterThanOrEqual(POOL_FITTING_RULES.drainSeparation)
        }
      }
      expect(poolAttachmentUpdates(Object.fromEntries([pool, ...children].map((node) => [node.id, node])))).toEqual([])
    }
  })

  test('tiny pools omit impossible drains and report the reason', () => {
    const plan = planPoolFittings(resized(PoolNode.parse({}), 0.5, 0.5))
    expect(plan.drains).toEqual([])
    expect(plan.issues.some((issue) => issue.includes('drains'))).toBe(true)
  })

  test('return counts cover the perimeter benchmark and fittings stay separated', () => {
    const pool = resized(PoolNode.parse({}), 25, 10)
    const plan = planPoolFittings(pool)
    expect(plan.inlets.length).toBeGreaterThanOrEqual(Math.ceil(plan.perimeter / 6.096))
    for (const inlet of plan.inlets) {
      for (const skimmer of plan.skimmers) {
        expect(Math.hypot(inlet.point[0] - skimmer.point[0], inlet.point[1] - skimmer.point[1])).toBeGreaterThanOrEqual(1.524)
      }
      for (const other of plan.inlets) if (other !== inlet) {
        expect(Math.hypot(inlet.point[0] - other.point[0], inlet.point[1] - other.point[1])).toBeGreaterThanOrEqual(0.65)
      }
    }
  })
  test('rectangular skimmers share one wall and returns use the perimeter', () => {
    for (const [length, width] of [[8, 4], [20, 12], [12, 20]]) {
      const plan = planPoolFittings(resized(PoolNode.parse({}), length!, width!))
      expect(new Set(plan.skimmers.map((station) => station.wallIndex)).size).toBe(1)
      expect(new Set(plan.inlets.map((station) => station.wallIndex)).size).toBeGreaterThan(1)
      expect(plan.inlets.every((inlet) => plan.skimmers.every((skimmer) => Math.hypot(inlet.point[0] - skimmer.point[0], inlet.point[1] - skimmer.point[1]) >= 1.524))).toBe(true)
    }
  })

  test('flat-pool drain row is exactly centered and evenly spaced', () => {
    const pool = PoolNode.parse({ fittingFlowRate: 26 })
    const drains = planPoolFittings(pool).drains
    expect(drains).toEqual([[-1, 0], [0, 0], [1, 0]])
    const larger = planPoolFittings(resized(pool, 16, 8)).drains
    expect(larger).toEqual(drains)
  })

  test('sloped-pool drains share a straight row centered across the deep floor', () => {
    const pool = PoolNode.parse({ floorProfile: 'shallow-to-deep', slopeEnd: 70, fittingFlowRate: 26 })
    const drains = planPoolFittings(pool).drains
    expect(drains).toHaveLength(3)
    expect(new Set(drains.map(([x]) => x)).size).toBe(1)
    expect(drains.map(([, z]) => z)).toEqual([-1, 0, 1])
    expect(drains[0]![0]).toBeCloseTo(2.8, 8)
  })

  test('side grouping survives reversed polygon winding', () => {
    const pool = PoolNode.parse({ polygon: [...PoolNode.parse({}).polygon].reverse() })
    const plan = planPoolFittings(pool)
    expect(plan.skimmers.every(({ point }) => point[0] === 4)).toBe(true)
    expect(new Set(plan.inlets.map(({ wallIndex }) => wallIndex)).size).toBeGreaterThan(1)
    expect(plan.drains).toEqual([[-0.5, 0], [0.5, 0]])
  })

})
