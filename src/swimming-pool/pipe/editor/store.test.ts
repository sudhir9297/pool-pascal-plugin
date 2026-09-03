import { describe, expect, test } from 'bun:test'
import { usePipeEditStore } from './store'

describe('PVC drawing continuation', () => {
  test('is single-run by default and can be toggled for continuous drawing', () => {
    usePipeEditStore.getState().setContinuousDrawing(false)
    expect(usePipeEditStore.getState().continuousDrawing).toBe(false)
    expect(usePipeEditStore.getState().toggleContinuousDrawing()).toBe(true)
    expect(usePipeEditStore.getState().continuousDrawing).toBe(true)
    expect(usePipeEditStore.getState().toggleContinuousDrawing()).toBe(false)
  })
})
