import type { NodeDefinition } from '@pascal-app/core'
import { connectionPorts } from '../../core/connection-ports'
import { DEFAULT_POOL_SKIMMER, PoolSkimmerNode } from './schema'
import { getSkimmerPortsLocal } from './ports'
import { poolSkimmerParametrics } from '../editor/parametrics'

export const poolSkimmerDefinition: NodeDefinition<typeof PoolSkimmerNode> = {
  kind: 'pool:skimmer',
  schemaVersion: 1,
  schema: PoolSkimmerNode,
  category: 'furnish',
  distributionRole: 'terminal',
  snapProfile: 'item',
  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    ...DEFAULT_POOL_SKIMMER,
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
  ports: (node) => connectionPorts(node, getSkimmerPortsLocal(node)),
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  parametrics: poolSkimmerParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place skimmer on pool wall' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
  presentation: {
    label: 'Pool skimmer',
    description: 'Wall-mounted surface skimmer with weir, basket, and suction port.',
    icon: { kind: 'iconify', name: 'lucide:filter' },
    paletteSection: 'furnish',
  },
}
