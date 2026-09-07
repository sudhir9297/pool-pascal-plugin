import type { NodeDefinition } from '@pascal-app/core'
import { DEFAULT_POOL_FILTER, PoolFilterNode } from './schema'
import { poolFilterParametrics } from '../editor/parametrics'

export const poolFilterDefinition: NodeDefinition<typeof PoolFilterNode> = {
  kind: 'pool:filter',
  schemaVersion: 1,
  schema: PoolFilterNode,
  category: 'furnish',
  distributionRole: 'run',
  snapProfile: 'item',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_FILTER }),
  capabilities: {
    movable: { axes: ['x', 'y', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  parametrics: poolFilterParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place pool filter' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
  presentation: {
    label: 'Pool filter',
    description: 'Place a detailed vertical filter tank with valve, gauge, and circulation ports.',
    icon: { kind: 'iconify', name: 'lucide:filter' },
    paletteSection: 'furnish',
  },
}
