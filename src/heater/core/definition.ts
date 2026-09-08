import type { NodeDefinition } from '@pascal-app/core'
import { connectionPorts } from '../../core/connection-ports'
import { DEFAULT_POOL_HEATER, PoolHeaterNode } from './schema'
import { poolHeaterParametrics } from '../editor/parametrics'
import { getHeaterConnectionPortsLocal } from './ports'

export const poolHeaterDefinition: NodeDefinition<typeof PoolHeaterNode> = {
  kind: 'pool:heater',
  schemaVersion: 1,
  schema: PoolHeaterNode,
  category: 'furnish',
  distributionRole: 'equipment',
  snapProfile: 'item',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_HEATER }),
  capabilities: {
    movable: { axes: ['x', 'y', 'z'], gridSnap: true, portSnap: { systems: ['waste'] } },
    rotatable: { axes: ['y'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  ports: (node) => connectionPorts(node, getHeaterConnectionPortsLocal(node)),
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  parametrics: poolHeaterParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place pool heater' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
  presentation: {
    label: 'Pool heater',
    description: 'Place a gas, electric, or heat-pump pool heater with circulation ports.',
    icon: { kind: 'iconify', name: 'lucide:flame' },
    paletteSection: 'furnish',
  },
}
