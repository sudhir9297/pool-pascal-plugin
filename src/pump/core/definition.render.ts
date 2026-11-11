import { poolComponentFloorplan } from '../../rendering/component-floorplan'
import { poolPlanMovableFrame } from '../../rendering/plan-frame'
import { connectionPorts } from '../../core/connection-ports'
import { getPumpPortsLocal } from './ports'
import { DEFAULT_POOL_PUMP, PoolPumpNode } from './schema'
import type { PoolRenderDefinition } from '../../definition-compose'

export const poolPumpRenderDefinition: PoolRenderDefinition<typeof PoolPumpNode> = {
  kind: 'pool:pump',
  schemaVersion: 1,
  schema: PoolPumpNode,
  category: 'furnish',
  distributionRole: 'equipment',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_PUMP }),
  capabilities: {
    movable: { parentFrame: poolPlanMovableFrame, axes: ['x', 'y', 'z'], gridSnap: true, portSnap: { systems: ['waste'] } },
    rotatable: { axes: ['x', 'y', 'z'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  ports: (node) => connectionPorts(node, getPumpPortsLocal(node)),
  floorplan: poolComponentFloorplan,
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  presentation: {
    label: 'Pool pump',
    description: 'Place a circulation pump with clearly marked inlet and outlet unions.',
    icon: { kind: 'iconify', name: 'lucide:fan' },
    paletteSection: 'furnish',
  },
}
