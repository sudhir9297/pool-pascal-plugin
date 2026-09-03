import type { NodeDefinition } from '@pascal-app/core'
import { PoolWatercourseNode } from './schema'

export const DEFAULT_POOL_WATERCOURSE = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  length: 3,
  width: 1.2,
  channelDepth: 0.35,
  waterDepth: 0.18,
  slope: -0.12,
  rockWidth: 0.28,
  rockSeed: 8129,
  rockColor: '#b8b7b0',
  waterColor: '#238fa8',
}

export const poolWatercourseDefinition: NodeDefinition<typeof PoolWatercourseNode> = {
  kind: 'pool:watercourse',
  schemaVersion: 1,
  schema: PoolWatercourseNode,
  category: 'furnish',
  distributionRole: 'run',
  snapProfile: 'item',
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_WATERCOURSE }),
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
  toolHints: [{ key: 'Click', label: 'Place watercourse' }, { key: 'Esc', label: 'Cancel placement' }],
  presentation: {
    label: 'Rock watercourse',
    description: 'Rock-lined channel connecting a pool, waterfall, or lower basin.',
    icon: { kind: 'iconify', name: 'lucide:arrow-down-up' },
    paletteSection: 'furnish',
  },
}
