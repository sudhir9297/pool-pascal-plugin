import { expect, test } from 'bun:test'
import { planDwvConnection } from './dwv-connection'

const port = (id: string, diameter = 2, system: 'waste' | 'vent' = 'waste') => ({
  id, position: [1, 2, 3] as [number, number, number], direction: [1, 0, 0] as [number, number, number], diameter, system,
})

test('creates a native DWV pipe plan for matching sockets', () => {
  expect(planDwvConnection(port('heater'), { ...port('filter'), position: [4, 2, 3] })).toMatchObject({ diameter: 2, system: 'waste', end: [4, 2, 3] })
})

test('rejects zero-length pipes and unsupported native pipe sizes', () => {
  expect(planDwvConnection(port('a'), port('b'))).toBeNull()
  expect(planDwvConnection(port('a', 0), { ...port('b', 0), position: [4, 2, 3] })).toBeNull()
})

test('rejects mismatched systems and sizes', () => {
  expect(planDwvConnection(port('a', 2), port('b', 3))).toBeNull()
  expect(planDwvConnection(port('a'), port('b', 2, 'vent'))).toBeNull()
})
