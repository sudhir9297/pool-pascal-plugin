import { poolPlanDependencies } from '../../rendering/plan-frame'
import type { PoolPumpNode } from './schema'
import { insertionDeletionHooks } from '../../editor/insertion-deletion'
import type { PoolEditContribution } from '../../definition-compose'

export const poolPumpEditContribution: PoolEditContribution<typeof PoolPumpNode> = {
  snapProfile: 'item',
  parametrics: {
    ...insertionDeletionHooks,
    groups: [{ label: 'Transform', fields: [{ key: 'position', kind: 'vec3' }, { key: 'rotation', kind: 'vec3' }] }],
    trailingSection: () => import('../../editor/connections'),
  },
  floorplanDependencies: poolPlanDependencies,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place circulation pump' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
}
