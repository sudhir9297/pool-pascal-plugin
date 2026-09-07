import type { NodeDefinition } from '@pascal-app/core'
import { DEFAULT_POOL_PUMP, PoolPumpNode } from './schema'

export const poolPumpDefinition: NodeDefinition<typeof PoolPumpNode> = {
  kind: 'pool:pump',
  schemaVersion: 1,
  schema: PoolPumpNode,
  category: 'furnish',
  distributionRole: 'run',
  snapProfile: 'item',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_PUMP }),
  capabilities: {
    movable: { axes: ['x', 'y', 'z'], gridSnap: true },
    rotatable: { axes: ['x', 'y', 'z'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place circulation pump' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
  presentation: {
    label: 'Pool pump',
    description: 'Place a circulation pump with clearly marked inlet and outlet unions.',
    icon: { kind: 'iconify', name: 'lucide:fan' },
    paletteSection: 'furnish',
  },
}
