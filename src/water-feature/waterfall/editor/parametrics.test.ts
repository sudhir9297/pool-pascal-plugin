import { describe, expect, test } from 'bun:test'
import { PoolWaterfallNode } from '../core/schema'
import { poolWaterfallParametrics } from './parametrics'

function field(key: string) {
  const result = poolWaterfallParametrics.groups
    .flatMap((group) => group.fields)
    .find((candidate) => candidate.key === key)
  if (!result) throw new Error(`Missing waterfall field: ${key}`)
  return result
}

describe('waterfall editor controls', () => {
  test('hides dimensions that mounted modern auto-size controls', () => {
    const automatic = PoolWaterfallNode.parse({
      poolId: 'pool_host',
      waterfallType: 'modern',
      autoSizeOnPool: true,
    })
    const manual = PoolWaterfallNode.parse({
      poolId: 'pool_host',
      waterfallType: 'modern',
      autoSizeOnPool: false,
    })

    for (const key of ['width', 'height', 'depth']) {
      const visibleIf = field(key).visibleIf!
      expect(visibleIf(automatic)).toBe(false)
      expect(visibleIf(manual)).toBe(true)
    }
  })

  test('keeps standalone placement and receiving-pool controls available', () => {
    const standalone = PoolWaterfallNode.parse({ poolId: null, receivingPoolEnabled: true })

    expect(field('position').visibleIf!(standalone)).toBe(true)
    expect(field('rotation').visibleIf!(standalone)).toBe(true)
    expect(field('receivingPoolWidth').visibleIf!(standalone)).toBe(true)
  })
})
