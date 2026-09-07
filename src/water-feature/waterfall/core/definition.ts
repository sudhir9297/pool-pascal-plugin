import type { NodeDefinition } from '@pascal-app/core'
import { poolWaterfallParametrics } from '../editor/parametrics'
import { DEFAULT_POOL_WATERFALL, PoolWaterfallNode } from './schema'

export const poolWaterfallDefinition: NodeDefinition<typeof PoolWaterfallNode> = {
  kind: 'pool:waterfall',
  schemaVersion: 3,
  schema: PoolWaterfallNode,
  category: 'furnish',
  distributionRole: 'run',
  snapProfile: 'item',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_WATERFALL }),
  capabilities: {
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  tool: () => import('../editor/tool'),
  toolHints: [{ key: 'Move', label: 'Aim at a pool edge or open ground' }, { key: 'Click', label: 'Place waterfall' }, { key: 'Esc', label: 'Cancel placement' }],
  parametrics: poolWaterfallParametrics,
  presentation: {
    label: 'Waterfall',
    description: 'Pool-edge or standalone waterfall with animated flow and optional receiving pool.',
    icon: { kind: 'iconify', name: 'lucide:landmark' },
    paletteSection: 'furnish',
  },
}
