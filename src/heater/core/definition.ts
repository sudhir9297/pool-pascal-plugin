import type { NodeDefinition } from '@pascal-app/core'
import { DEFAULT_POOL_HEATER, PoolHeaterNode } from './schema'
import { poolHeaterParametrics } from '../editor/parametrics'

export const poolHeaterDefinition: NodeDefinition<typeof PoolHeaterNode> = {
  kind: 'pool:heater',
  schemaVersion: 1,
  schema: PoolHeaterNode,
  category: 'furnish',
  distributionRole: 'run',
  snapProfile: 'item',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_HEATER }),
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
