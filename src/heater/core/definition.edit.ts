import { poolPlanDependencies } from '../../rendering/plan-frame'
import type { PoolHeaterNode } from './schema'
import { poolHeaterParametrics } from '../editor/parametrics'
import type { PoolEditContribution } from '../../definition-compose'

export const poolHeaterEditContribution: PoolEditContribution<typeof PoolHeaterNode> = {
  snapProfile: 'item',
  floorplanDependencies: poolPlanDependencies,
  parametrics: poolHeaterParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place pool heater' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
}
