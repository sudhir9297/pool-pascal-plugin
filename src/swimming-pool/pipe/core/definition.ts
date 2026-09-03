import type { NodeDefinition } from '@pascal-app/core'
import { STANDARD_POOL_PVC_DIAMETER } from './constants'
import { PoolPipeNode } from './schema'

export const DEFAULT_POOL_PIPE = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  kitId: 'pvc',
  diameter: STANDARD_POOL_PVC_DIAMETER,
  nodes: [] as Array<PoolPipeNode['nodes'][number]>,
  edges: [] as Array<PoolPipeNode['edges'][number]>,
  attachments: [] as Array<PoolPipeNode['attachments'][number]>,
}

export const poolPipeDefinition: NodeDefinition<typeof PoolPipeNode> = {
  kind: 'pool:pipe-network',
  schemaVersion: 1,
  schema: PoolPipeNode,
  category: 'furnish',
  distributionRole: 'run',
  snapProfile: 'item',
  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    ...DEFAULT_POOL_PIPE,
  }),
  capabilities: {
    movable: { axes: ['x', 'y', 'z'], gridSnap: true },
    rotatable: { axes: ['x', 'y', 'z'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'First click', label: 'Set pipe start' },
    { key: 'Second click', label: 'Place pipe end' },
    { key: 'Esc', label: 'Cancel pipe drawing' },
  ],
  presentation: {
    label: 'PVC pipe network',
    description: 'Draw and connect editable PVC pipe runs.',
    icon: { kind: 'iconify', name: 'lucide:workflow' },
    paletteSection: 'furnish',
    // PVC networks expose their own Pipe-It-style endpoint cubes, plus
    // handles, and insertion controls. The generic floating action menu can
    // overlap those controls and re-arm whole-node dragging.
    actionMenu: false,
  },
}
