import { poolComponentFloorplan } from '../../rendering/component-floorplan'
import { poolPlanMovableFrame } from '../../rendering/plan-frame'
import { connectionPorts } from '../../core/connection-ports'
import { DEFAULT_POOL_FILTER, PoolFilterNode } from './schema'
import { getFilterConnectionPortsLocal } from './ports'
import type { PoolRenderDefinition } from '../../definition-compose'

export const poolFilterRenderDefinition: PoolRenderDefinition<typeof PoolFilterNode> = {
  kind: 'pool:filter',
  schemaVersion: 1,
  schema: PoolFilterNode,
  category: 'furnish',
  distributionRole: 'equipment',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_FILTER }),
  capabilities: {
    movable: { parentFrame: poolPlanMovableFrame, axes: ['x', 'y', 'z'], gridSnap: true, portSnap: { systems: ['waste'] } },
    rotatable: { axes: ['y'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  ports: (node) => connectionPorts(node, getFilterConnectionPortsLocal(node)),
  floorplan: poolComponentFloorplan,
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  presentation: {
    label: 'Pool filter',
    description: 'Place a detailed vertical filter tank with valve, gauge, and circulation ports.',
    icon: { kind: 'iconify', name: 'lucide:filter' },
    paletteSection: 'furnish',
  },
}
