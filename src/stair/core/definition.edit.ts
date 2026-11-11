import { poolFittingFloorplanMove } from '../../editor/floorplan-fitting-move'
import { poolPlanDependencies } from '../../rendering/plan-frame'
import { poolStairParametrics } from '../editor/parametrics'
import type { PoolStairNode } from './schema'
import type { PoolEditContribution } from '../../definition-compose'

export const poolStairEditContribution: PoolEditContribution<typeof PoolStairNode> = {
  snapProfile: 'item',
  floorplanMoveTarget: poolFittingFloorplanMove,
  floorplanDependencies: poolPlanDependencies,
  parametrics: poolStairParametrics,
  tool: () => import('../editor/tool'),
  affordanceTools: { move: () => import('../editor/move-tool') },
  toolHints: [{ key: 'Click', label: 'Place stairs on pool wall' }, { key: 'Esc', label: 'Cancel placement' }],
}
