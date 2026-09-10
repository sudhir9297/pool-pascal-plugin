import { useScene, type NodeDefinition } from '@pascal-app/core'
import { PoolNode } from '../../core/schema'
import { resolveMountedSkimmer } from '../design/placement'
import { connectionPorts } from '../../core/connection-ports'
import { DEFAULT_POOL_SKIMMER, PoolSkimmerNode } from './schema'
import { getSkimmerPortsLocal } from './ports'
import { poolSkimmerParametrics } from '../editor/parametrics'

export const poolSkimmerDefinition: NodeDefinition<typeof PoolSkimmerNode> = {
  kind: 'pool:skimmer',
  affordanceTools: { move: () => import('../../editor/move-fitting-tool') },
  schemaVersion: 1,
  schema: PoolSkimmerNode,
  category: 'furnish',
  distributionRole: 'terminal',
  snapProfile: 'item',
  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    ...DEFAULT_POOL_SKIMMER,
  }),
  capabilities: {
    movable: { axes: ['x', 'y', 'z'], gridSnap: true },
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
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  parametrics: poolSkimmerParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place skimmer on pool wall' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
  presentation: {
    label: 'Pool skimmer',
    description: 'Wall-mounted surface skimmer with weir, basket, and suction port.',
    icon: { kind: 'iconify', name: 'lucide:filter' },
    paletteSection: 'furnish',
  },
}
