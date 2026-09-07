import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../../../core/schema'
import { createPoolShapePolygon } from '../../../design/shapes'
import { PoolWaterfallNode } from '../core/schema'
import { createStandaloneWaterfallPlacement, findNearestWaterfallPlacement, getMountedWaterfallDimensions, placementOnPoolBoundary, resolveMountedWaterfall } from './placement'

describe('pool waterfall placement', () => {
  test('snaps to the pool edge, faces inward, and inherits the water surface', () => {
    const pool = PoolNode.parse({
      id: 'pool_waterfall_edge',
      position: [2, 0.4, 3],
      finishedDeckElevation: 0.25,
      designWaterElevation: 0.08,
      waterColor: '#06b6d4',
      waterPreset: 'vivid-aqua',
      shallowWaterColor: '#00d9a3',
      deepWaterColor: '#007f99',
    })
    const placement = findNearestWaterfallPlacement([6.3, 3], [pool], 3.6)

    expect(placement?.position).toEqual([6, 0.65, 3])
    expect(placement?.poolId).toBe(pool.id)
    expect(placement?.rotation[1]).toBeCloseTo(-Math.PI / 2)
    expect(placement?.targetWaterOffset).toBeCloseTo(-0.17)
    expect(placement?.waterPreset).toBe('vivid-aqua')
    expect(placement?.shallowWaterColor).toBe('#00d9a3')
    expect(placement?.deepWaterColor).toBe('#007f99')
  })

  test('accounts for the host pool rotation', () => {
    const pool = PoolNode.parse({
      id: 'pool_waterfall_rotated',
      position: [1, 0, 2],
      rotation: [0, Math.PI / 2, 0],
    })
    const placement = placementOnPoolBoundary(pool, 1, 0.5, 3.6)

    expect(placement?.position[0]).toBeCloseTo(1)
    expect(placement?.position[2]).toBeCloseTo(-2)
    expect(placement?.rotation[1]).toBeCloseTo(0)
  })

  test('samples the surrounding boundary so the rock formation bends with a curved pool', () => {
    const polygon = Array.from({ length: 16 }, (_, index) => {
      const angle = index / 16 * Math.PI * 2
      return [Math.cos(angle) * 4, Math.sin(angle) * 4] as [number, number]
    })
    const pool = PoolNode.parse({ id: 'pool_waterfall_curve', shape: 'custom', polygon })
    const placement = placementOnPoolBoundary(pool, 0, 0.5, 4.2)

    expect(placement?.edgeCurve).toHaveLength(9)
    expect(placement?.edgeCurve.every((point, index, curve) => index === 0 || point[0] > curve[index - 1]![0])).toBe(true)
    const depths = placement?.edgeCurve.map((point) => point[1]) ?? []
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(0.1)
  })

  test('keeps a square pool edge ordered across a sharp corner', () => {
    const pool = PoolNode.parse({
      id: 'pool_waterfall_square',
      length: 6,
      width: 6,
      polygon: createPoolShapePolygon('rectangle', 6, 6),
    })
    const placement = placementOnPoolBoundary(pool, 1, 0.5, 3.6)

    expect(placement?.edgeCurve.map(([x]) => x)).toEqual([
      -2.07, -1.5525, -1.035, -0.5175, 0, 0.5175, 1.035, 1.5525, 2.07,
    ])
    expect(placement?.edgeCurve.every((point, index, curve) => index === 0 || point[0] > curve[index - 1]![0])).toBe(true)
  })

  test('turns a waterfall cleanly around the short wall of an L-shaped pool', () => {
    const pool = PoolNode.parse({
      id: 'pool_waterfall_l_turn',
      shape: 'l-shape',
      polygon: createPoolShapePolygon('l-shape', 8, 6),
    })
    const placement = placementOnPoolBoundary(pool, 1, 0.12, 3.6)
    const depths = placement?.edgeCurve.map(([, z]) => z) ?? []

    expect(placement).not.toBeNull()
    expect(placement?.edgeCurve.every((point, index, curve) => index === 0 || point[0] > curve[index - 1]![0])).toBe(true)
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(0.5)
  })

  test('remains mounted when its host pool moves or changes elevation', () => {
    const pool = PoolNode.parse({
      id: 'pool_waterfall_live',
      position: [5, 1, -2],
      finishedDeckElevation: 0.3,
      designWaterElevation: 0.1,
      waterPreset: 'tropical-lagoon',
      shallowWaterColor: '#28e8fb',
      deepWaterColor: '#0078ad',
    })
    const node = PoolWaterfallNode.parse({ poolId: pool.id, wallIndex: 1, wallT: 0.5 })
    const mounted = resolveMountedWaterfall(node, pool)

    expect(mounted.position).toEqual([9, 1.3, -2])
    expect(mounted.targetWaterOffset).toBeCloseTo(-0.2)
    expect(mounted.receivingPoolEnabled).toBe(false)
    expect(mounted.waterPreset).toBe('tropical-lagoon')
    expect(mounted.shallowWaterColor).toBe('#28e8fb')
    expect(mounted.deepWaterColor).toBe('#0078ad')
  })

  test('auto-sizes a modern waterfall to a compact pool-edge footprint', () => {
    const pool = PoolNode.parse({ id: 'pool_waterfall_small_modern' })
    const dimensions = getMountedWaterfallDimensions(pool, 0)
    const mounted = resolveMountedWaterfall(PoolWaterfallNode.parse({
      poolId: pool.id,
      waterfallType: 'modern',
    }), pool)

    expect(dimensions.width).toBeLessThan(2)
    expect(dimensions.height).toBeLessThan(1.1)
    expect(dimensions.depth).toBeLessThan(0.9)
    expect(mounted.width).toBe(dimensions.width)
    expect(mounted.height).toBe(dimensions.height)
    expect(mounted.depth).toBe(dimensions.depth)
  })

  test('ignores duplicate boundary points without losing a valid nearby placement', () => {
    const validPool = PoolNode.parse({ id: 'pool_waterfall_valid' })
    const duplicateEdgePool = PoolNode.parse({
      id: 'pool_waterfall_duplicate',
      shape: 'custom',
      polygon: [[0, 0], [0, 0], [2, 0], [2, 2], [0, 2]],
    })

    const placement = findNearestWaterfallPlacement([4.1, 0], [validPool, duplicateEdgePool], 1.2)

    expect(placement).not.toBeNull()
    expect(Number.isFinite(placement!.position[0])).toBe(true)
    expect(Number.isFinite(placement!.position[2])).toBe(true)
  })

  test('creates a standalone placement with its own receiving pool', () => {
    const node = PoolWaterfallNode.parse({
      rotation: [0, 0.4, 0],
      waterPreset: 'vivid-aqua',
      shallowWaterColor: '#56ddea',
      deepWaterColor: '#087f9e',
    })

    const placement = createStandaloneWaterfallPlacement([2, 0.5, -3], node)

    expect(placement.position).toEqual([2, 0.5, -3])
    expect(placement.rotation).toEqual([0, 0.4, 0])
    expect(placement.poolId).toBeNull()
    expect(placement.poolRockSeed).toBeNull()
    expect(placement.waterPreset).toBe('vivid-aqua')
  })
})
