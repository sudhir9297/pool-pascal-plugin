import { describe, expect, test } from 'bun:test'
import {
  POOL_FINISHES,
  POOL_FINISH_SETTINGS,
  getPoolFinishSettings,
} from './pool-finishes'

describe('pool interior finishes', () => {
  test('includes clean, aggregate, pebble, glass, and mosaic families', () => {
    expect(POOL_FINISHES).toEqual([
      'clean-white-plaster',
      'clean-pale-blue-plaster',
      'white-plaster',
      'quartz-white',
      'quartz-blue-gray',
      'natural-pebble-aqua',
      'natural-pebble-gray',
      'polished-aggregate-blue',
      'glass-bead-aqua',
      'light-mosaic',
      'blue-mosaic',
      'dark-mosaic',
    ])
  })

  test('keeps clean plaster genuinely pattern-free', () => {
    expect(POOL_FINISH_SETTINGS['clean-white-plaster'].kind).toBe('solid')
    expect(POOL_FINISH_SETTINGS['clean-pale-blue-plaster'].kind).toBe('solid')
    expect(POOL_FINISH_SETTINGS['white-plaster'].kind).toBe('solid')
  })

  test('falls back safely for old or invalid finish values', () => {
    expect(getPoolFinishSettings('missing').kind).toBe('mosaic')
    expect(getPoolFinishSettings(undefined)).toEqual(POOL_FINISH_SETTINGS['light-mosaic'])
  })
})
