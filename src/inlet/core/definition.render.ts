import { poolComponentFloorplan } from '../../rendering/component-floorplan'
import { poolPlanMovableFrame } from '../../rendering/plan-frame'
import { connectionPorts } from '../../core/connection-ports'
import { DEFAULT_POOL_INLET, PoolInletNode } from './schema'
import { getInletPortsLocal } from './ports'
import type { PoolRenderDefinition } from '../../definition-compose'

export const poolInletRenderDefinition: PoolRenderDefinition<typeof PoolInletNode> = {
  kind: 'pool:inlet',
  schemaVersion: 1,
  schema: PoolInletNode,
  category: 'furnish',
  distributionRole: 'terminal',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_INLET }),
  capabilities: {
    movable: { parentFrame: poolPlanMovableFrame, axes: ['x', 'y', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  ports: (node) => connectionPorts(node, getInletPortsLocal(node)),
  floorplan: poolComponentFloorplan,
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  presentation: {
    label: 'Pool return inlet',
    description: 'Wall-mounted return fitting that sends filtered water back into the pool.',
    icon: { kind: 'iconify', name: 'lucide:circle-dot' },
    paletteSection: 'furnish',
  },
}
