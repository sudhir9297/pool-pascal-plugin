import { poolPlanDependencies } from '../../rendering/plan-frame'
import { useEditor } from '@pascal-app/editor'
import { useScene, type AnyNode } from '@pascal-app/core'
import type { PoolValveNode } from './schema'
import { poolValveParametrics } from '../editor/parametrics'
import type { PoolEditContribution } from '../../definition-compose'

export const poolValveEditContribution: PoolEditContribution<typeof PoolValveNode> = {
  snapProfile: 'item',
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
  floorplanDependencies: poolPlanDependencies,
  parametrics: poolValveParametrics,
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Click', label: 'Place suction valve' },
    { key: 'Alt', label: 'Switch rotation axis' },
    { key: 'R', label: 'Rotate 90° on selected axis' },
    { key: 'E', label: 'Operate valve handle' },
    { key: 'Esc', label: 'Cancel placement' },
  ],
}
