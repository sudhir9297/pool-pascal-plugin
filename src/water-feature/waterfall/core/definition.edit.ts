import { poolPlanDependencies } from '../../../rendering/plan-frame'
import { poolWaterfallParametrics } from '../editor/parametrics'
import type { PoolWaterfallNode } from './schema'
import type { PoolEditContribution } from '../../../definition-compose'

export const poolWaterfallEditContribution: PoolEditContribution<typeof PoolWaterfallNode> = {
  snapProfile: 'item',
  floorplanDependencies: poolPlanDependencies,
  tool: () => import('../editor/tool'),
  toolHints: [{ key: 'Move', label: 'Aim at a pool edge or open ground' }, { key: 'Click', label: 'Place waterfall' }, { key: 'Esc', label: 'Cancel placement' }],
  parametrics: poolWaterfallParametrics,
}
