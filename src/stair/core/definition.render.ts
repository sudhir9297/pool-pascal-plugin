import { poolComponentFloorplan } from '../../rendering/component-floorplan'
import { poolPlanMovableFrame } from '../../rendering/plan-frame'
import { DEFAULT_POOL_STAIR, PoolStairNode } from './schema'
import type { PoolRenderDefinition } from '../../definition-compose'

export const poolStairRenderDefinition: PoolRenderDefinition<typeof PoolStairNode> = {
  kind: 'pool:stair', schemaVersion: 2, schema: PoolStairNode, category: 'furnish', distributionRole: 'run',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_STAIR }),
  capabilities: { movable: { parentFrame: poolPlanMovableFrame, axes: ['x', 'y', 'z'], gridSnap: true }, rotatable: { axes: ['y'] }, selectable: { hitVolume: 'bbox' }, duplicable: true, deletable: true, groupable: true, snappable: {} },
  floorplan: poolComponentFloorplan,
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  presentation: { label: 'Pool ladders', description: 'Stainless-steel wall ladders based on the supplied pool references.', icon: { kind: 'iconify', name: 'lucide:steps' }, paletteSection: 'furnish' },
}
