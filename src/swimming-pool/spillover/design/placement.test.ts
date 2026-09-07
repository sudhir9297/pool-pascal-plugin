import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../../core/schema'
import { resolvePoolSpillover } from './placement'

const rectangle = [[-2, -1.5], [2, -1.5], [2, 1.5], [-2, 1.5]]

describe('pool spillover placement', () => {
  test('connects overlapping pools across their shared run', () => {
    const upper = PoolNode.parse({ id: 'pool_upper', parentId: 'level_a', position: [0, 1, 0], polygon: rectangle })
    const lower = PoolNode.parse({ id: 'pool_lower', parentId: 'level_a', position: [3.5, 0, 0], polygon: rectangle })
    const placement = resolvePoolSpillover(lower, upper)

    expect(placement?.sourcePoolId).toBe(upper.id)
    expect(placement?.targetPoolId).toBe(lower.id)
    expect(placement?.connectionMode).toBe('overlap')
    expect(placement?.connectionPath).toEqual([[2, 0], [1.5, 0]])
    expect(placement?.sourceOpening).toHaveLength(4)
    expect(placement?.targetOpening).toHaveLength(4)
    expect(placement?.dropHeight).toBeCloseTo(1)
    expect(placement?.intersection.length).toBeGreaterThan(0)
    expect(placement?.width).toBeCloseTo(3)
    expect(placement?.length).toBeCloseTo(0.5)
  })

  test('connects pools whose walls exactly touch', () => {
    const upper = PoolNode.parse({ id: 'pool_upper_touching', parentId: 'level_a', position: [0, 0.8, 0], polygon: rectangle })
    const lower = PoolNode.parse({ id: 'pool_lower_touching', parentId: 'level_a', position: [4, 0, 0], polygon: rectangle })
    const placement = resolvePoolSpillover(upper, lower)

    expect(placement).not.toBeNull()
    expect(placement?.position[0]).toBeCloseTo(2)
    expect(placement?.position[2]).toBeCloseTo(0)
    expect(placement?.sourcePoolId).toBe(upper.id)
    expect(placement?.targetPoolId).toBe(lower.id)
    expect(placement?.connectionMode).toBe('channel')
    expect(placement?.dropHeight).toBeCloseTo(0.8)
  })

  test('lets an overlapping pair use a watercourse when requested', () => {
    const upper = PoolNode.parse({ id: 'pool_upper_override', parentId: 'level_a', position: [0, 1, 0], polygon: rectangle })
    const lower = PoolNode.parse({ id: 'pool_lower_override', parentId: 'level_a', position: [3.5, 0, 0], polygon: rectangle })

    const placement = resolvePoolSpillover(upper, lower, 'watercourse')

    expect(placement?.connectionMode).toBe('channel')
  })

  test('uses the intersecting curved footprint for pools at the same level', () => {
    const first = PoolNode.parse({ id: 'pool_same_level_a', parentId: 'level_a', shape: 'custom',
      polygon: [[-3,-2],[2,-2],[2,2],[-3,2]], position: [0,0,0] })
    const second = PoolNode.parse({ id: 'pool_same_level_b', parentId: 'level_a', shape: 'custom',
      polygon: [[-2,-1],[3,-1],[3,1],[-2,1]], position: [2,0,0] })
    const placement = resolvePoolSpillover(first, second)
    expect(placement).not.toBeNull()
    expect(placement?.connectionMode).toBe('overlap')
    expect(placement?.sourcePoolId).toBe(first.id)
    expect(placement?.sourceEdge).toHaveLength(41)
    expect(placement?.targetEdge).toEqual(placement?.sourceEdge)
    expect(placement?.dropHeight).toBeCloseTo(0.02)
  })

  test('renders an explicit direct spillover without a watercourse bed', () => {
    const upper = PoolNode.parse({ id: 'pool_upper_direct', parentId: 'level_a', position: [0, 1, 0], polygon: rectangle })
    const lower = PoolNode.parse({ id: 'pool_lower_direct', parentId: 'level_a', position: [3.5, 0, 0], polygon: rectangle })

    expect(resolvePoolSpillover(upper, lower, 'direct-spillover')?.connectionMode).toBe('direct')
  })

  test('connects separated pools with a channel spanning the full gap', () => {
    const upper = PoolNode.parse({ id: 'pool_upper_gap', parentId: 'level_a', position: [0, 1.2, 0], polygon: rectangle })
    const lower = PoolNode.parse({ id: 'pool_lower_gap', parentId: 'level_a', position: [5.25, 0, 0], polygon: rectangle })
    const placement = resolvePoolSpillover(upper, lower)

    expect(placement).not.toBeNull()
    expect(placement?.sourcePoolId).toBe(upper.id)
    expect(placement?.targetPoolId).toBe(lower.id)
    expect(placement?.position[0]).toBeCloseTo(2.625)
    expect(placement?.length).toBeCloseTo(1.25)
    expect(placement?.dropHeight).toBeCloseTo(1.2)
    expect(placement?.intersection).toHaveLength(1)
    const footprintX = placement?.intersection[0]?.map(([x]) => x) ?? []
    expect(Math.min(...footprintX)).toBeCloseTo(1.85)
    expect(Math.max(...footprintX)).toBeCloseTo(3.4)
    expect(placement?.connectionPath).toEqual([[2, 0], [3.25, 0]])
    const sourceOpeningX = placement?.sourceOpening.map(([x]) => x) ?? []
    const targetOpeningX = placement?.targetOpening.map(([x]) => x) ?? []
    expect(Math.min(...sourceOpeningX)).toBeCloseTo(1.75)
    expect(Math.max(...sourceOpeningX)).toBeCloseTo(2.25)
    expect(Math.min(...targetOpeningX)).toBeCloseTo(3)
    expect(Math.max(...targetOpeningX)).toBeCloseTo(3.5)
  })

  test('connects separated pools with a bedless direct water sheet when requested', () => {
    const upper = PoolNode.parse({ id: 'pool_upper_safe', parentId: 'level_a', position: [0, 1, 0], polygon: rectangle })
    const lower = PoolNode.parse({ id: 'pool_lower_safe', parentId: 'level_a', position: [5, 0, 0], polygon: rectangle })

    const placement = resolvePoolSpillover(upper, lower, 'direct-spillover')

    expect(placement?.connectionMode).toBe('direct')
  })

  test('rejects a shared run narrower than the supported spillover width', () => {
    const upper = PoolNode.parse({
      id: 'pool_upper_narrow',
      parentId: 'level_a',
      position: [0, 1, 0],
      polygon: rectangle,
    })
    const lower = PoolNode.parse({
      id: 'pool_lower_narrow',
      parentId: 'level_a',
      position: [3.8, 0, 2.8],
      polygon: rectangle,
    })

    expect(resolvePoolSpillover(upper, lower)).toBeNull()
  })

  test('connects separated pools after applying their world rotations', () => {
    const rotation: [number, number, number] = [0, Math.PI / 2, 0]
    const upper = PoolNode.parse({
      id: 'pool_upper_rotated',
      parentId: 'level_a',
      position: [0, 1, 0],
      rotation,
      polygon: rectangle,
    })
    const lower = PoolNode.parse({
      id: 'pool_lower_rotated',
      parentId: 'level_a',
      position: [4, 0, 0],
      rotation,
      polygon: rectangle,
    })
    const placement = resolvePoolSpillover(upper, lower)

    expect(placement).not.toBeNull()
    expect(placement?.position[0]).toBeCloseTo(2)
    expect(placement?.position[2]).toBeCloseTo(0)
    expect(placement?.length).toBeCloseTo(1)
    expect(placement?.width).toBeCloseTo(3.6)
  })

  test('connects rotated freeform pools across facing boundary runs', () => {
    const rotation = Math.PI / 6
    const firstPolygon = [[-3, -2], [2, -2], [2, 1], [1, 2], [-3, 2]]
    const secondPolygon = [[-2, -1.5], [3, -1.5], [3, 2], [-1, 2], [-2, 1]]
    const upper = PoolNode.parse({
      id: 'pool_freeform_upper', parentId: 'level_a', shape: 'custom',
      position: [0, 1, 0], rotation: [0, rotation, 0], polygon: firstPolygon,
    })
    const lower = PoolNode.parse({
      id: 'pool_freeform_lower', parentId: 'level_a', shape: 'custom',
      position: [5.5 * Math.cos(rotation), 0, -5.5 * Math.sin(rotation)],
      rotation: [0, rotation, 0], polygon: secondPolygon,
    })

    const placement = resolvePoolSpillover(upper, lower)

    expect(placement).not.toBeNull()
    expect(placement?.connectionMode).toBe('channel')
    expect(placement?.sourceOpening).toHaveLength(4)
    expect(placement?.targetOpening).toHaveLength(4)
    expect(placement?.connectionPath).toHaveLength(2)
  })

  test('rejects corner-only arrangements without a usable facing run', () => {
    const first = PoolNode.parse({ id: 'pool_corner_a', parentId: 'level_a', polygon: rectangle })
    const second = PoolNode.parse({ id: 'pool_corner_b', parentId: 'level_a', position: [4.5, 3.5, 4], polygon: rectangle })

    expect(resolvePoolSpillover(first, second)).toBeNull()
  })

  test('rejects pools on different levels', () => {
    const first = PoolNode.parse({ id: 'pool_a', parentId: 'level_a', polygon: rectangle })
    const second = PoolNode.parse({ id: 'pool_b', parentId: 'level_b', position: [3.5, 0, 0], polygon: rectangle })

    expect(resolvePoolSpillover(first, second)).toBeNull()
  })
})
