import { poolComponentFloorplan } from '../../../rendering/component-floorplan'
import { DEFAULT_POOL_WATERFALL, PoolWaterfallNode } from './schema'
import { bakePoolWaterfallAnimations } from '../../../core/export-animation'
import type { PoolRenderDefinition } from '../../../definition-compose'

export const poolWaterfallRenderDefinition: PoolRenderDefinition<typeof PoolWaterfallNode> = {
  kind: 'pool:waterfall',
  schemaVersion: 3,
  schema: PoolWaterfallNode,
  category: 'furnish',
  distributionRole: 'run',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_WATERFALL }),
  capabilities: {
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  floorplan: poolComponentFloorplan,
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  exportAnimation: ({ node, object }) => bakePoolWaterfallAnimations(node, object),
  presentation: {
    label: 'Waterfall',
    description: 'Pool-edge or standalone waterfall with animated flow and optional receiving pool.',
    icon: { kind: 'iconify', name: 'lucide:landmark' },
    paletteSection: 'furnish',
  },
}
