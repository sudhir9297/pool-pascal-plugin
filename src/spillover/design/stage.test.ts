import { describe, expect, test } from 'bun:test'
import {
  firstPoolHintVisibility,
  getPoolSpilloverPlacementStage,
  secondPoolHintVisibility,
  setPoolSpilloverPlacementStage,
} from './stage'

describe('pool spillover placement stage', () => {
  test('updates hint visibility and notifies subscribers once per change', () => {
    setPoolSpilloverPlacementStage('first-pool')
    let changes = 0
    const unsubscribe = secondPoolHintVisibility.subscribe(() => { changes += 1 })

    expect(getPoolSpilloverPlacementStage()).toBe('first-pool')
    expect(firstPoolHintVisibility.value()).toBe(true)
    expect(secondPoolHintVisibility.value()).toBe(false)

    setPoolSpilloverPlacementStage('second-pool')
    setPoolSpilloverPlacementStage('second-pool')

    expect(changes).toBe(1)
    expect(firstPoolHintVisibility.value()).toBe(false)
    expect(secondPoolHintVisibility.value()).toBe(true)

    unsubscribe()
    setPoolSpilloverPlacementStage('first-pool')
    expect(changes).toBe(1)
  })
})
