import type { NodeDefinition, ToolHintChip } from '@pascal-app/core'
import { STANDARD_POOL_PVC_DIAMETER } from './constants'
import { PoolPipeNode } from './schema'
import { usePipeEditStore } from '../editor/store'

const continuousDrawingChip: ToolHintChip = {
  subscribe: (listener) => usePipeEditStore.subscribe(() => listener()),
  value: () => usePipeEditStore.getState().continuousDrawing ? 'continuous' : 'single',
  cycle: () => { usePipeEditStore.getState().toggleContinuousDrawing() },
  labels: {
    single: 'Drawing: Single',
    continuous: 'Drawing: Continuous',
  },
  icons: {
    single: 'lucide:mouse-pointer-click',
    continuous: 'lucide:repeat-2',
  },
  tooltip: 'Drawing mode — click or press C to toggle',
}

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
    // Network rotation is intentionally handled by fitting-level controls.
    // Keeping the generic node rotator enabled draws a large editor ring
    // around the whole PVC network and permits an invalid global rotation.
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
    { key: 'C', label: 'Drawing mode', chip: continuousDrawingChip },
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
