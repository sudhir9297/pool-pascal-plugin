import type { NodeDefinition } from '@pascal-app/core'
import { PoolPumpNode } from './schema'

export const DEFAULT_POOL_PUMP = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  diameter: 0.05,
  bodyWidth: 0.42,
  bodyHeight: 0.34,
  bodyDepth: 0.62,
  showFlow: false,
}

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
    { key: 'Alt', label: 'Switch rotation axis' },
    { key: 'R', label: 'Rotate 90° on selected axis' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
  presentation: {
    label: 'Pool pump',
    description: 'Place a circulation pump with clearly marked inlet and outlet unions.',
    icon: { kind: 'iconify', name: 'lucide:fan' },
    paletteSection: 'furnish',
  },
}
