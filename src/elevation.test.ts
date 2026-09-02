import { beforeAll, describe, expect, test } from 'bun:test'
import {
  type AnyNode,
  BuildingNode,
  initSpatialGridSync,
  LevelNode,
  loadPlugin,
  SlabNode,
  useScene,
} from '@pascal-app/core'
import { draftElevation, featureElevation } from './swimming-pool/design/elevation'
import { poolPlugin, PoolNode } from './index'

/**
 * The elevation contract an instanced kind has to satisfy by hand.
 *
 * A feature's stored Y is always 0 — the surface it stands on is resolved at render
 * time. For a per-node kind the host does that for free, but a collective renderer
 * draws into one `InstancedMesh`, and the host's `FloorElevationSystem` only writes
 * to a node's *registered* object, which here is the invisible selection proxy. So
 * `instanced.tsx` resolves it, through the functions under test.
 *
 * Every assertion below would read 0 under the old `node.position[1]`, which is
 * exactly why the bug survived: in a flat test scene the broken and correct code
 * agree.
 */

const DECK_ELEVATION = 1.2
const KINDS = ['pool:pool']

/** `level_0` at grade, optionally holding a 30×30 deck slab over the origin. */
function scene(deckElevation: number | null) {
  const children: string[] = []
  const nodes: AnyNode[] = []

  if (deckElevation !== null) {
    const deck = SlabNode.parse({
      parentId: 'level_0',
      polygon: [
        [0, 0],
        [30, 0],
        [30, 30],
        [0, 30],
      ],
      elevation: deckElevation,
      thickness: 0.05,
    }) as AnyNode
    children.push(deck.id as string)
    nodes.push(deck)
  }

  nodes.push(
    BuildingNode.parse({ id: 'building_a', parentId: null, children: ['level_0'] }) as AnyNode,
    LevelNode.parse({
      id: 'level_0',
      level: 0,
      height: 2.5,
      parentId: 'building_a',
      children,
    }) as AnyNode,
  )

  return Object.fromEntries(nodes.map((node) => [node.id, node])) as Record<string, AnyNode>
}

/**
 * Publish a scene and let the spatial grid index it. The slab election reads that
 * index, not the record — without the settle every lookup reports "no slab" and
 * the deck cases pass as 0 for the wrong reason.
 */
async function publish(nodes: Record<string, AnyNode>) {
  useScene.setState({ nodes } as never)
  await Bun.sleep(30)
}

/** A committed feature of `kind`, positioned flat the way its tool commits it. */
function feature(kind: string, x: number, z: number) {
  const poolDefaults = kind === 'pool:pool' ? PoolNode.parse({}) : {}
  return {
    ...poolDefaults,
    id: `${kind}_1`,
    type: kind,
    object: 'node' as const,
    parentId: 'level_0',
    visible: true,
    metadata: {},
    position: [x, 0, z] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    height: 1.5,
  }
}

beforeAll(async () => {
  // The resolver reads each kind's `floorPlaced` footprint off the registry.
  await loadPlugin(poolPlugin as never)
  initSpatialGridSync()
})

describe.each(KINDS)('%s', (kind) => {
  test('rests on the storey plane with nothing under it', async () => {
    const nodes = scene(null)
    await publish(nodes)

    expect(featureElevation(feature(kind, 2, 2), nodes)).toBe(0)
  })

  test('rides a slab it stands on rather than its stored zero', async () => {
    const nodes = scene(DECK_ELEVATION)
    await publish(nodes)

    const node = feature(kind, 2, 2)
    expect(node.position[1]).toBe(0)
    expect(featureElevation(node, nodes)).toBeCloseTo(DECK_ELEVATION)
  })

  test('a feature beyond the slab stays on the storey plane', async () => {
    const nodes = scene(DECK_ELEVATION)
    await publish(nodes)

    // Outside the deck's 0..30 footprint: the lift is per-position, not global.
    expect(featureElevation(feature(kind, 100, 100), nodes)).toBe(0)
  })
})

describe('placement ghost', () => {
  test('previews the surface the commit will land on', async () => {
    const nodes = scene(DECK_ELEVATION)
    await publish(nodes)

    // An uncommitted draft has no parent, so the level is named explicitly.
    const draft = { ...feature('pool:pool', 0, 0), parentId: null }
    expect(draftElevation(draft, 'level_0', [2, 0, 2], nodes)).toBeCloseTo(DECK_ELEVATION)
    expect(draftElevation(draft, 'level_0', [100, 0, 100], nodes)).toBe(0)
  })

  test('an unresolvable level keeps the ghost flat rather than throwing', async () => {
    const nodes = scene(DECK_ELEVATION)
    await publish(nodes)

    const draft = { ...feature('pool:pool', 0, 0), parentId: null }
    expect(draftElevation(draft, 'level_missing', [2, 0, 2], nodes)).toBe(0)
  })
})
