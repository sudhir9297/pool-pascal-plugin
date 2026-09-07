import type { NodeDefinition } from '@pascal-app/core'
import { DEFAULT_POOL_DRAIN, PoolDrainNode } from './schema'
import { poolDrainParametrics } from '../editor/parametrics'

export const poolDrainDefinition: NodeDefinition<typeof PoolDrainNode> = {
  kind: 'pool:drain',
  schemaVersion: 1,
  schema: PoolDrainNode,
  category: 'furnish',
  distributionRole: 'run',
  snapProfile: 'item',
  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    ...DEFAULT_POOL_DRAIN,
  }),
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
  parametrics: poolDrainParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place pool drain on floor' },
    { key: 'R', label: 'Rotate drain' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
  presentation: {
    label: 'Pool drain',
    description: 'Place a floor-mounted drain with a removable grate and suction outlet.',
    icon: { kind: 'iconify', name: 'lucide:circle-dot' },
    paletteSection: 'furnish',
  },
}
