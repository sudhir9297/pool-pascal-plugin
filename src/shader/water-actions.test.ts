import { describe, expect, test } from 'bun:test'
import { subscribePoolWaterActions, triggerPoolWaterAction } from './water-actions'

describe('pool water actions', () => {
  test('delivers actions only to listeners for the matching pool', () => {
    const first: string[] = []
    const second: string[] = []
    const unsubscribeFirst = subscribePoolWaterActions('pool_first', (action) => first.push(action))
    const unsubscribeSecond = subscribePoolWaterActions('pool_second', (action) => second.push(action))

    triggerPoolWaterAction('pool_first', 'splash')
    triggerPoolWaterAction('pool_first', 'calm')

    expect(first).toEqual(['splash', 'calm'])
    expect(second).toEqual([])
    unsubscribeFirst()
    unsubscribeSecond()
  })

  test('stops delivery after unsubscribe and tolerates repeated cleanup', () => {
    const actions: string[] = []
    const unsubscribe = subscribePoolWaterActions('pool_cleanup', (action) => actions.push(action))
    unsubscribe()
    unsubscribe()
    triggerPoolWaterAction('pool_cleanup', 'storm')

    expect(actions).toEqual([])
  })
})
