import type { NodeDefinition } from '@pascal-app/core'
import { poolInletParametrics } from '../editor/parametrics'
import { PoolInletNode } from './schema'

export const DEFAULT_POOL_INLET = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  poolId: null,
  wallIndex: 0,
  wallT: 0.5,
  verticalOffset: -0.45,
  nozzleDiameter: 0.05,
  flangeRadius: 0.12,
  bodyDepth: 0.16,
  showFlow: false,
  flowLength: 0.35,
}

export const poolInletDefinition: NodeDefinition<typeof PoolInletNode> = {
  kind: 'pool:inlet',
  schemaVersion: 1,
  schema: PoolInletNode,
  category: 'furnish',
  distributionRole: 'run',
  snapProfile: 'item',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_INLET }),
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
  parametrics: poolInletParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place return inlet on pool wall' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
  presentation: {
    label: 'Pool return inlet',
    description: 'Wall-mounted return fitting that sends filtered water back into the pool.',
    icon: { kind: 'iconify', name: 'lucide:circle-dot' },
    paletteSection: 'furnish',
  },
}
