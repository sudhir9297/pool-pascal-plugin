import { poolComponentFloorplan } from '../../rendering/component-floorplan'
import { poolPlanMovableFrame } from '../../rendering/plan-frame'
import { connectionPorts } from '../../core/connection-ports'
import { DEFAULT_POOL_HEATER, PoolHeaterNode } from './schema'
import { getHeaterConnectionPortsLocal } from './ports'
import type { PoolRenderDefinition } from '../../definition-compose'

export const poolHeaterRenderDefinition: PoolRenderDefinition<typeof PoolHeaterNode> = {
  kind: 'pool:heater',
  schemaVersion: 1,
  schema: PoolHeaterNode,
  category: 'furnish',
  distributionRole: 'equipment',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_HEATER }),
  capabilities: {
    movable: { parentFrame: poolPlanMovableFrame, axes: ['x', 'y', 'z'], gridSnap: true, portSnap: { systems: ['waste'] } },
    rotatable: { axes: ['y'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  ports: (node) => connectionPorts(node, getHeaterConnectionPortsLocal(node)),
  floorplan: poolComponentFloorplan,
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  presentation: {
    label: 'Pool heater',
    description: 'Place a gas, electric, or heat-pump pool heater with circulation ports.',
    icon: { kind: 'iconify', name: 'lucide:flame' },
    paletteSection: 'furnish',
  },
}
