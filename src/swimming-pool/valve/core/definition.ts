import { useEditor } from '@pascal-app/editor'
import { useScene, type AnyNode, type NodeDefinition } from '@pascal-app/core'
import { PoolValveNode } from './schema'
import { poolValveParametrics } from '../editor/parametrics'

export const DEFAULT_POOL_VALVE = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  variant: 'two-way' as const,
  flowPattern: 'open' as const,
  diameter: 0.05,
  bodyRadius: 0.11,
  handleAngle: 0,
}

export const poolValveDefinition: NodeDefinition<typeof PoolValveNode> = {
  kind: 'pool:valve',
  schemaVersion: 1,
  schema: PoolValveNode,
  category: 'furnish',
  distributionRole: 'run',
  snapProfile: 'item',
  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    ...DEFAULT_POOL_VALVE,
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
  keyboardActions: {
    axisCycling: true,
    r: {
      appliesTo: (node) => String(node.type) === 'pool:valve',
      run: (node: AnyNode) => {
        const valve = node as unknown as PoolValveNode
        const axis = useEditor.getState().rotationAxis
        const rotation = [...valve.rotation] as [number, number, number]
        const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
        rotation[index] += Math.PI / 2
        useScene.getState().updateNode(valve.id as never, { rotation } as unknown as Partial<AnyNode>)
      },
    },
    e: {
      appliesTo: (node) => String(node.type) === 'pool:valve',
      run: (node: AnyNode) => {
        const valve = node as unknown as PoolValveNode
        const nextHandleAngle = (valve.handleAngle + Math.PI / 2) % (Math.PI * 2)
        const nextFlowPattern = valve.variant === 'two-way'
          ? valve.flowPattern === 'open' ? 'closed' : 'open'
          : (['left-right', 'left-branch', 'all', 'right-branch'] as const)[Math.round(nextHandleAngle / (Math.PI / 2)) % 4]!
        useScene.getState().updateNode(valve.id as never, { handleAngle: nextHandleAngle, flowPattern: nextFlowPattern } as unknown as Partial<AnyNode>)
      },
    },
  },
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  parametrics: poolValveParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place suction valve' },
    { key: 'Alt', label: 'Switch rotation axis' },
    { key: 'R', label: 'Rotate 90° on selected axis' },
    { key: 'E', label: 'Operate valve handle' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
  presentation: {
    label: 'PVC suction valve',
    description: 'Place a 2-way or 3-way PVC ball valve with pipe sockets.',
    icon: { kind: 'iconify', name: 'lucide:between-horizontal-start' },
    paletteSection: 'furnish',
  },
}
