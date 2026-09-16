import { expect, test } from 'bun:test'
import { poolParametrics } from './parametrics'

test('pool inspector starts with pool settings before circulation controls', () => {
  expect(poolParametrics.groups.map(({ label }) => label)).toEqual([
    'Pool geometry',
    'Water shader',
    'Automatic fittings',
    'Inlet pipes',
    'Drain pipes',
    'Skimmer pipes',
    'Transform',
  ])
})
