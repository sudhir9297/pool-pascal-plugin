import { poolFittingFloorplanMove } from '../../editor/floorplan-fitting-move'
import { poolPlanDependencies } from '../../rendering/plan-frame'
import type { PoolDrainNode } from './schema'
import { poolDrainParametrics } from '../editor/parametrics'
import type { PoolEditContribution } from '../../definition-compose'

export const poolDrainEditContribution: PoolEditContribution<typeof PoolDrainNode> = {
  affordanceTools: { move: () => import('../../editor/move-fitting-tool') },
  snapProfile: 'item',
  floorplanMoveTarget: poolFittingFloorplanMove,
  floorplanDependencies: poolPlanDependencies,
  parametrics: poolDrainParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place pool drain on floor' },
    { key: 'R', label: 'Rotate drain' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
}
