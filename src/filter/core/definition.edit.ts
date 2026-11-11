import { poolPlanDependencies } from '../../rendering/plan-frame'
import type { PoolFilterNode } from './schema'
import { poolFilterParametrics } from '../editor/parametrics'
import type { PoolEditContribution } from '../../definition-compose'

export const poolFilterEditContribution: PoolEditContribution<typeof PoolFilterNode> = {
  snapProfile: 'item',
  floorplanDependencies: poolPlanDependencies,
  parametrics: poolFilterParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place pool filter' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
}
