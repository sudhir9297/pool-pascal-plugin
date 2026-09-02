import type { NodeDefinition } from '@pascal-app/core'
import { PoolSkimmerNode } from './schema'

export const DEFAULT_POOL_SKIMMER = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  poolId: null,
  wallIndex: 0,
  wallT: 0.5,
  style: 'standard' as const,
  accessState: 'closed' as const,
  showFlow: false,
  bodyWidth: 0.6,
  bodyHeight: 0.55,
  bodyDepth: 0.42,
  mouthWidth: 0.42,
  mouthHeight: 0.14,
  waterlineOffset: 0,
  suctionDiameter: 0.05,
  showBasket: true,
  showPipePort: true,
}

export const poolSkimmerDefinition: NodeDefinition<typeof PoolSkimmerNode> = {
  kind: 'pool:skimmer',
  schemaVersion: 1,
  schema: PoolSkimmerNode,
  category: 'furnish',
  distributionRole: 'run',
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
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
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
