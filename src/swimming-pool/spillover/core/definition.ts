import type { NodeDefinition } from '@pascal-app/core'
import { poolSpilloverParametrics } from '../editor/parametrics'
import { PoolSpilloverNode } from './schema'

export const DEFAULT_POOL_SPILLOVER = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  sourcePoolId: '',
  targetPoolId: '',
  intersection: [] as Array<Array<[number, number]>>,
  sourceSide: 1 as const,
  width: 2,
  length: 0.8,
  dropHeight: 0.25,
  lipThickness: 0.08,
  flowStrength: 1,
  waterColor: '#38bdf8',
  surfaceColor: '#e2e8f0',
}

export const poolSpilloverDefinition: NodeDefinition<typeof PoolSpilloverNode> = {
  kind: 'pool:spillover',
  schemaVersion: 1,
  schema: PoolSpilloverNode,
  category: 'furnish',
  distributionRole: 'run',
  snapProfile: 'item',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_SPILLOVER }),
  capabilities: {
    movable: { axes: ['x', 'y', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: false,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Select the higher pool, then the receiving pool' },
    { key: 'Esc', label: 'Cancel spillover placement' },
  ],
  parametrics: poolSpilloverParametrics,
  presentation: {
    label: 'Pool spillover',
    description: 'Directional water flow from a higher swimming pool into a lower pool.',
    icon: { kind: 'iconify', name: 'lucide:move-down' },
    paletteSection: 'furnish',
  },
}
