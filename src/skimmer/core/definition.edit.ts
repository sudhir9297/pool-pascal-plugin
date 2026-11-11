import { poolFittingFloorplanMove } from '../../editor/floorplan-fitting-move'
import { poolPlanDependencies } from '../../rendering/plan-frame'
import type { PoolSkimmerNode } from './schema'
import { poolSkimmerParametrics } from '../editor/parametrics'
import type { PoolEditContribution } from '../../definition-compose'

export const poolSkimmerEditContribution: PoolEditContribution<typeof PoolSkimmerNode> = {
  affordanceTools: { move: () => import('../../editor/move-fitting-tool') },
  snapProfile: 'item',
  floorplanMoveTarget: poolFittingFloorplanMove,
  floorplanDependencies: poolPlanDependencies,
  parametrics: poolSkimmerParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place skimmer on pool wall' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
}
