import { poolFittingFloorplanMove } from '../../editor/floorplan-fitting-move'
import { poolPlanDependencies } from '../../rendering/plan-frame'
import { poolInletParametrics } from '../editor/parametrics'
import type { PoolInletNode } from './schema'
import type { PoolEditContribution } from '../../definition-compose'

export const poolInletEditContribution: PoolEditContribution<typeof PoolInletNode> = {
  affordanceTools: { move: () => import('../../editor/move-fitting-tool') },
  snapProfile: 'item',
  floorplanMoveTarget: poolFittingFloorplanMove,
  floorplanDependencies: poolPlanDependencies,
  parametrics: poolInletParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place return inlet on pool wall' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
}
