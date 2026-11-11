import { poolComponentFloorplan } from '../../rendering/component-floorplan'
import { poolPlanMovableFrame } from '../../rendering/plan-frame'
import { connectionPorts } from '../../core/connection-ports'
import { DEFAULT_POOL_DRAIN, PoolDrainNode } from './schema'
import { getDrainPortsLocal } from './ports'
import type { PoolRenderDefinition } from '../../definition-compose'

export const poolDrainRenderDefinition: PoolRenderDefinition<typeof PoolDrainNode> = {
  kind: 'pool:drain',
  schemaVersion: 1,
  schema: PoolDrainNode,
  category: 'furnish',
  distributionRole: 'terminal',
  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    ...DEFAULT_POOL_DRAIN,
  }),
  capabilities: {
    movable: { parentFrame: poolPlanMovableFrame, axes: ['x', 'y', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  ports: (node) => connectionPorts(node, getDrainPortsLocal(node)),
  floorplan: poolComponentFloorplan,
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  presentation: {
    label: 'Pool drain',
    description: 'Place a floor-mounted drain with a removable grate and suction outlet.',
    icon: { kind: 'iconify', name: 'lucide:circle-dot' },
    paletteSection: 'furnish',
  },
}
