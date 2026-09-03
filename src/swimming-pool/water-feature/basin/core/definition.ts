import type { NodeDefinition } from '@pascal-app/core'
import { PoolCatchBasinNode } from './schema'

export const DEFAULT_POOL_CATCH_BASIN = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  length: 3.2,
  width: 2.2,
  depth: 0.9,
  waterDepth: 0.55,
  wallThickness: 0.18,
  copingWidth: 0.35,
  copingThickness: 0.12,
  copingStoneLength: 0.7,
  copingSeed: 4207,
  shellColor: '#697978',
  waterColor: '#238fa8',
}

export const poolCatchBasinDefinition: NodeDefinition<typeof PoolCatchBasinNode> = {
  kind: 'pool:catch-basin',
  schemaVersion: 1,
  schema: PoolCatchBasinNode,
  category: 'furnish',
  distributionRole: 'run',
  snapProfile: 'item',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_CATCH_BASIN }),
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
  toolHints: [{ key: 'Click', label: 'Place lower catch basin' }, { key: 'Esc', label: 'Cancel placement' }],
  presentation: {
    label: 'Lower catch basin',
    description: 'Natural secondary basin for a pool waterfall or cascade.',
    icon: { kind: 'iconify', name: 'lucide:waves' },
    paletteSection: 'furnish',
  },
}
