import { poolComponentFloorplan } from '../../rendering/component-floorplan'
import { poolPlanMovableFrame } from '../../rendering/plan-frame'
import { useScene } from '@pascal-app/core'
import { PoolNode } from '../../core/schema'
import { resolveMountedSkimmer } from '../design/placement'
import { connectionPorts } from '../../core/connection-ports'
import { DEFAULT_POOL_SKIMMER, PoolSkimmerNode } from './schema'
import { getSkimmerPortsLocal } from './ports'
import type { PoolRenderDefinition } from '../../definition-compose'

export const poolSkimmerRenderDefinition: PoolRenderDefinition<typeof PoolSkimmerNode> = {
  kind: 'pool:skimmer',
  schemaVersion: 1,
  schema: PoolSkimmerNode,
  category: 'furnish',
  distributionRole: 'terminal',
  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    ...DEFAULT_POOL_SKIMMER,
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
  ports: (node) => {
    const pool = PoolNode.safeParse(node.poolId ? useScene.getState().nodes[node.poolId as never] : null)
    const mounted = resolveMountedSkimmer(node, pool.success ? pool.data : null)
    return connectionPorts(mounted, getSkimmerPortsLocal(mounted))
  },
  floorplan: poolComponentFloorplan,
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  presentation: {
    label: 'Pool skimmer',
    description: 'Wall-mounted surface skimmer with weir, basket, and suction port.',
    icon: { kind: 'iconify', name: 'lucide:filter' },
    paletteSection: 'furnish',
  },
}
