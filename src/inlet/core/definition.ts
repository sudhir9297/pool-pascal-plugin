import type { NodeDefinition } from '@pascal-app/core'
import { connectionPorts } from '../../core/connection-ports'
import { poolInletParametrics } from '../editor/parametrics'
import { DEFAULT_POOL_INLET, PoolInletNode } from './schema'
import { getInletPortsLocal } from './ports'

export const poolInletDefinition: NodeDefinition<typeof PoolInletNode> = {
  kind: 'pool:inlet',
  affordanceTools: { move: () => import('../../editor/move-fitting-tool') },
  schemaVersion: 1,
  schema: PoolInletNode,
  category: 'furnish',
  distributionRole: 'terminal',
  snapProfile: 'item',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_INLET }),
  capabilities: {
    movable: { axes: ['x', 'y', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  ports: (node) => connectionPorts(node, getInletPortsLocal(node)),
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  parametrics: poolInletParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place return inlet on pool wall' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
  presentation: {
    label: 'Pool return inlet',
    description: 'Wall-mounted return fitting that sends filtered water back into the pool.',
    icon: { kind: 'iconify', name: 'lucide:circle-dot' },
    paletteSection: 'furnish',
  },
}
