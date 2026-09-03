import { describe, expect, test } from 'bun:test'
import { POOL_STAIR_CATALOG, POOL_STAIR_VARIANTS } from './catalog'

describe('pool stair catalog', () => {
  test('defines the four supplied reference options', () => {
    expect(POOL_STAIR_VARIANTS).toEqual(['extended', 'classic', 'square', 'compact'])
    for (const variant of POOL_STAIR_VARIANTS) {
      const preset = POOL_STAIR_CATALOG[variant]
      expect(preset.stepCount).toBeGreaterThanOrEqual(3)
      expect(preset.width).toBeGreaterThan(0)
      expect(preset.depth).toBeGreaterThan(0)
    }
  })
})
