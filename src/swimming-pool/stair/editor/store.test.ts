import { beforeEach, describe, expect, test } from 'bun:test'
import { usePoolStairStore } from './store'

describe('pool stair preset selection', () => {
  beforeEach(() => usePoolStairStore.getState().selectVariant('classic'))

  test('loads every model property when the option changes', () => {
    usePoolStairStore.getState().selectVariant('extended')
    const state = usePoolStairStore.getState()
    expect(state.variant).toBe('extended')
    expect(state.stepCount).toBe(5)
    expect(state.depth).toBe(1.5)
  })
})
