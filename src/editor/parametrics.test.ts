import { expect, test } from 'bun:test'
import { poolParametrics } from './parametrics'

test('pool inspector starts with pool settings before circulation controls', () => {
  expect(poolParametrics.groups.map(({ label, defaultExpanded }) => ({ label, defaultExpanded }))).toEqual([
    { label: 'Pool geometry', defaultExpanded: true },
    { label: 'Water shader', defaultExpanded: false },
    { label: 'Automatic fittings', defaultExpanded: false },
    { label: 'Inlet pipes', defaultExpanded: false },
    { label: 'Drain pipes', defaultExpanded: false },
    { label: 'Skimmer pipes', defaultExpanded: false },
    { label: 'Transform', defaultExpanded: false },
  ])
})
