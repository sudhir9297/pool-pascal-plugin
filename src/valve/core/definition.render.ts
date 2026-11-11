import { poolComponentFloorplan } from '../../rendering/component-floorplan'
import { poolPlanMovableFrame } from '../../rendering/plan-frame'
import { connectionPorts } from '../../core/connection-ports'
import { DEFAULT_POOL_VALVE, PoolValveNode } from './schema'
import { getValvePortsLocal } from './ports'
import type { PoolRenderDefinition } from '../../definition-compose'

export const poolValveRenderDefinition: PoolRenderDefinition<typeof PoolValveNode> = {
  kind: 'pool:valve',
  schemaVersion: 1,
  schema: PoolValveNode,
  category: 'furnish',
  distributionRole: 'fitting',
  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    ...DEFAULT_POOL_VALVE,
  }),
  capabilities: {
    movable: { parentFrame: poolPlanMovableFrame, axes: ['x', 'y', 'z'], gridSnap: true, cursorAttached: true, portSnap: { systems: ['waste'] } },
    rotatable: { axes: ['x', 'y', 'z'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  ports: (node) => connectionPorts(node, getValvePortsLocal(node)),
  floorplan: poolComponentFloorplan,
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  presentation: {
    label: 'Suction valve',
    description: 'Place a 2-way or 3-way ball valve with connection sockets.',
    icon: { kind: 'iconify', name: 'lucide:between-horizontal-start' },
    paletteSection: 'furnish',
  },
}
