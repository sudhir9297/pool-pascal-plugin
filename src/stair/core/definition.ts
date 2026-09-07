import type { NodeDefinition } from '@pascal-app/core'
import { poolStairParametrics } from '../editor/parametrics'
import { PoolStairNode } from './schema'

export const DEFAULT_POOL_STAIR = {
  position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number],
  poolId: null, wallIndex: 0, wallT: 0.5, variant: 'classic' as const, stepCount: 4,
  width: 0.5, depth: 1.4, tubeDiameter: 0.043, treadDepth: 0.11, metalColor: '#dce3e8',
}

export const poolStairDefinition: NodeDefinition<typeof PoolStairNode> = {
  kind: 'pool:stair', schemaVersion: 2, schema: PoolStairNode, category: 'furnish', distributionRole: 'run', snapProfile: 'item',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_STAIR }),
  capabilities: { movable: { axes: ['x', 'y', 'z'], gridSnap: true }, rotatable: { axes: ['y'] }, selectable: { hitVolume: 'bbox' }, duplicable: true, deletable: true, groupable: true, snappable: {} },
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  parametrics: poolStairParametrics,
  tool: () => import('../editor/tool'),
  affordanceTools: { move: () => import('../editor/move-tool') },
  toolHints: [{ key: 'Click', label: 'Place stairs on pool wall' }, { key: 'Esc', label: 'Cancel placement' }],
  presentation: { label: 'Pool ladders', description: 'Stainless-steel wall ladders based on the supplied pool references.', icon: { kind: 'iconify', name: 'lucide:steps' }, paletteSection: 'furnish' },
}
