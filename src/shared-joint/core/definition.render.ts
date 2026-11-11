import { poolComponentFloorplan } from '../../rendering/component-floorplan'
import { poolPlanMovableFrame } from '../../rendering/plan-frame'
import { PoolSharedJointNode } from './schema'
import { bakePoolConnectionAnimations } from '../../core/export-animation'
import type { PoolRenderDefinition } from '../../definition-compose'

const DEFAULT_POOL_SHARED_JOINT = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  poolIds: ['', ''] as [string, string],
  intersection: [] as Array<Array<[number, number]>>,
  copingStyle: 'continuous' as const,
  connectionMode: 'submerged-shelf' as const,
  length: 1,
  width: 1,
  thickness: 0.08,
  rockWidth: 0.28,
  transitionDepth: 0.55,
  transitionHeight: 0.18,
  transitionColor: '#2b7182',
  commonFloorDepth: 1.5,
  waterElevation: -0.12,
  rockSeed: 9733,
  surfaceColor: '#b8b7b0',
}

export const poolSharedJointRenderDefinition: PoolRenderDefinition<typeof PoolSharedJointNode> = {
  kind: 'pool:shared-joint',
  schemaVersion: 1,
  schema: PoolSharedJointNode,
  category: 'furnish',
  distributionRole: 'run',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_SHARED_JOINT }),
  capabilities: {
    movable: { parentFrame: poolPlanMovableFrame, axes: ['x', 'y', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: false,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  floorplan: poolComponentFloorplan,
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  exportAnimation: ({ node, object }) => bakePoolConnectionAnimations(node, object),
  presentation: {
    label: 'Pool connection',
    description: 'A submerged transition and shared rock seam between two nearby pools.',
    icon: { kind: 'iconify', name: 'lucide:unfold-horizontal' },
    paletteSection: 'furnish',
  },
}
