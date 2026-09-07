import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../../core/schema'
import { buildPoolSpilloverGeometry } from '../core/geometry'
import { PoolSpilloverNode } from '../core/schema'
import { resolvePoolSpilloverSyncUpdate, syncPoolSpillovers } from './sync'

const rectangle = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]]

function pool(id: string, position: [number, number, number], parentId = 'level_a') {
  return PoolNode.parse({ id, parentId, position, polygon: rectangle })
}

function spillover(sourcePoolId: string, targetPoolId: string, overrides: Record<string, unknown> = {}) {
  return PoolSpilloverNode.parse({
    id: `pool-spillover_${sourcePoolId}_${targetPoolId}`,
    parentId: 'level_a',
    sourcePoolId,
    targetPoolId,
    ...overrides,
  })
}

describe('pool spillover synchronization', () => {
  test('keeps a manually selected watercourse while recomputing its placement', () => {
    const upper = PoolNode.parse({ id: 'pool_sync_upper', parentId: 'level_a', position: [0, 1, 0], polygon: rectangle })
    const lower = PoolNode.parse({ id: 'pool_sync_lower', parentId: 'level_a', position: [3.5, 0, 0], polygon: rectangle })
    const spillover = PoolSpilloverNode.parse({
      id: 'pool-spillover_sync',
      parentId: 'level_a',
      sourcePoolId: upper.id,
      targetPoolId: lower.id,
      connectionStyle: 'watercourse',
      width: 0.8,
    })

    const changes = syncPoolSpillovers({
      [upper.id]: upper,
      [lower.id]: lower,
      [spillover.id]: spillover,
    } as never)

    expect(changes.delete).toEqual([])
    expect(changes.update).toHaveLength(1)
    expect(changes.update[0]?.data.connectionMode).toBe('channel')
    expect(changes.update[0]?.data.width).toBeCloseTo(0.8)
    const openingZ = changes.update[0]?.data.sourceOpening?.map(([, z]) => z) ?? []
    expect(Math.min(...openingZ)).toBeCloseTo(-0.4)
    expect(Math.max(...openingZ)).toBeCloseTo(0.4)
    expect(changes.update[0]?.data).not.toHaveProperty('connectionStyle')
  })

  test('reverses flow when the receiving pool becomes higher', () => {
    const first = pool('pool_first', [0, 0, 0])
    const second = pool('pool_second', [5, 1.4, 0])
    const connection = spillover(first.id, second.id)

    const changes = syncPoolSpillovers({ [first.id]: first, [second.id]: second, [connection.id]: connection } as never)

    expect(changes.delete).toEqual([])
    expect(changes.update[0]?.data.sourcePoolId).toBe(second.id)
    expect(changes.update[0]?.data.targetPoolId).toBe(first.id)
    expect(changes.update[0]?.data.connectionPath?.[0]).toEqual([3, 0])
    expect(changes.update[0]?.data.connectionPath?.[1]).toEqual([2, 0])
    expect(changes.update[0]?.data.dropHeight).toBeCloseTo(1.4)
  })

  test('renders the falling sheet at the new target after an elevation reversal', () => {
    const originalSource = pool('pool_visual_right', [5, -1, 0])
    const newlyHigher = pool('pool_visual_left', [0, -0.5, 0])
    const connection = spillover(originalSource.id, newlyHigher.id)
    const update = syncPoolSpillovers({
      [originalSource.id]: originalSource,
      [newlyHigher.id]: newlyHigher,
      [connection.id]: connection,
    } as never).update[0]?.data
    const synced = PoolSpilloverNode.parse({ ...connection, ...update })
    const geometry = buildPoolSpilloverGeometry(synced)
    const sheet = geometry.getObjectByName('pool-spillover-water-sheet')!
    const angle = synced.rotation[1]
    const worldSheet = [
      synced.position[0] + sheet.position.x * Math.cos(angle),
      synced.position[2] - sheet.position.x * Math.sin(angle),
    ]

    expect(synced.sourcePoolId).toBe(newlyHigher.id)
    expect(synced.targetPoolId).toBe(originalSource.id)
    expect(worldSheet[0]).toBeCloseTo(synced.connectionPath[1]![0])
    expect(worldSheet[1]).toBeCloseTo(synced.connectionPath[1]![1])
    geometry.traverse((child) => {
      if ('geometry' in child) (child as { geometry: { dispose: () => void } }).geometry.dispose()
      if ('material' in child) {
        const materials = Array.isArray((child as { material: unknown }).material)
          ? (child as { material: Array<{ dispose: () => void }> }).material
          : [(child as { material: { dispose: () => void } }).material]
        materials.forEach((material) => material.dispose())
      }
    })
  })

  test('derives a live reversal even before the stored connection update is applied', () => {
    const staleSource = pool('pool_live_right', [5, -1, 0])
    const newlyHigher = pool('pool_live_left', [0, -0.5, 0])
    const staleConnection = spillover(staleSource.id, newlyHigher.id, {
      connectionPath: [[3, 0], [2, 0]],
    })

    const update = resolvePoolSpilloverSyncUpdate(staleConnection, staleSource, newlyHigher)

    expect(update?.sourcePoolId).toBe(newlyHigher.id)
    expect(update?.targetPoolId).toBe(staleSource.id)
    expect(update?.connectionPath[0]).toEqual([2, 0])
    expect(update?.connectionPath[1]).toEqual([3, 0])
  })

  test('preserves desired width and custom colors while clamping only effective geometry', () => {
    const upper = pool('pool_width_upper', [0, 1, 0])
    const narrow = pool('pool_width_lower', [5, 0, 1.4])
    const connection = spillover(upper.id, narrow.id, {
      width: 2.5,
      waterColor: '#123456',
      surfaceColor: '#654321',
    })

    const narrowed = syncPoolSpillovers({ [upper.id]: upper, [narrow.id]: narrow, [connection.id]: connection } as never)
    const narrowUpdate = narrowed.update[0]?.data
    expect(narrowUpdate?.width).toBe(2.5)
    expect(narrowUpdate?.effectiveWidth).toBeLessThan(2.5)
    expect(narrowUpdate?.waterColor).toBe('#123456')
    expect(narrowUpdate?.surfaceColor).toBe('#654321')

    const narrowedConnection = PoolSpilloverNode.parse({ ...connection, ...narrowUpdate })
    const wide = PoolNode.parse({ ...narrow, position: [5, 0, 0] })
    const widened = syncPoolSpillovers({ [upper.id]: upper, [wide.id]: wide, [connection.id]: narrowedConnection } as never)
    expect(widened.update[0]?.data.width).toBe(2.5)
    expect(widened.update[0]?.data.effectiveWidth).toBe(2.5)
  })

  test('updates the path after translation and rotation', () => {
    const upper = pool('pool_move_upper', [0, 1, 0])
    const lower = PoolNode.parse({
      ...pool('pool_move_lower', [0, 0, 5]),
      rotation: [0, Math.PI / 2, 0],
    })
    const connection = spillover(upper.id, lower.id)

    const changes = syncPoolSpillovers({ [upper.id]: upper, [lower.id]: lower, [connection.id]: connection } as never)

    expect(changes.delete).toEqual([])
    expect(changes.update[0]?.data.connectionPath).toHaveLength(2)
    expect(changes.update[0]?.data.position?.[2]).toBeCloseTo(2.25)
    expect(changes.update[0]?.data.rotation?.[1]).toBeCloseTo(-Math.PI / 2)
  })

  test('accepts an exact 20 metre shell gap and rejects anything beyond it', () => {
    const upper = pool('pool_boundary_upper', [0, 1, 0])
    const atLimit = pool('pool_boundary_limit', [24, 0, 0])
    const overLimit = PoolNode.parse({ ...atLimit, position: [24.001, 0, 0] })
    const connection = spillover(upper.id, atLimit.id)

    const accepted = syncPoolSpillovers({ [upper.id]: upper, [atLimit.id]: atLimit, [connection.id]: connection } as never)
    expect(accepted.delete).toEqual([])
    expect(accepted.update[0]?.data.length).toBeCloseTo(20)

    const rejected = syncPoolSpillovers({ [upper.id]: upper, [overLimit.id]: overLimit, [connection.id]: connection } as never)
    expect(rejected.update).toEqual([])
    expect(rejected.delete).toEqual([connection.id])
  })

  test('deletes orphaned and cross-level spillovers', () => {
    const upper = pool('pool_orphan_upper', [0, 1, 0])
    const lower = pool('pool_orphan_lower', [5, 0, 0])
    const connection = spillover(upper.id, lower.id)

    expect(syncPoolSpillovers({ [upper.id]: upper, [connection.id]: connection } as never).delete).toEqual([connection.id])

    const movedLevel = PoolNode.parse({ ...lower, parentId: 'level_b' })
    expect(syncPoolSpillovers({ [upper.id]: upper, [movedLevel.id]: movedLevel, [connection.id]: connection } as never).delete).toEqual([connection.id])
  })

  test('upgrades a legacy connection with current endpoint geometry during sync', () => {
    const upper = pool('pool_legacy_upper', [0, 1, 0])
    const lower = pool('pool_legacy_lower', [5, 0, 0])
    const legacy = spillover(upper.id, lower.id, {
      intersection: [[[1.8, -1], [3.2, -1], [3.2, 1], [1.8, 1]]],
    })

    const update = syncPoolSpillovers({ [upper.id]: upper, [lower.id]: lower, [legacy.id]: legacy } as never).update[0]?.data

    expect(update?.sourceOpening).toHaveLength(4)
    expect(update?.targetOpening).toHaveLength(4)
    expect(update?.connectionPath).toHaveLength(2)
    expect(update?.effectiveWidth).toBeGreaterThanOrEqual(0.3)
  })
})
