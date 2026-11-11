import { poolSpilloverParametrics } from '../editor/parametrics'
import { firstPoolHintVisibility, secondPoolHintVisibility } from '../design/stage'
import type { PoolSpilloverNode } from './schema'
import type { PoolEditContribution } from '../../definition-compose'

const poolSpilloverToolHints = [
  { key: 'Click', label: 'Select the first pool', visible: firstPoolHintVisibility },
  { key: 'Click', label: 'Select the second pool', visible: secondPoolHintVisibility },
  { key: 'Move', label: 'Preview the connection', visible: secondPoolHintVisibility },
  { key: 'Esc', label: 'Cancel spillover placement' },
]

export const poolSpilloverEditContribution: PoolEditContribution<typeof PoolSpilloverNode> = {
  snapProfile: 'item',
  extensions: {
    'pascal:editor/floorplan': {
      tool: () => import('../editor/floorplan-tool'),
    },
  },
  tool: () => import('../editor/tool'),
  toolHints: poolSpilloverToolHints,
  parametrics: poolSpilloverParametrics,
}
