import type { ParametricDescriptor } from '@pascal-app/core'
import type { PoolSharedJointNode } from '../core/schema'

export const poolSharedJointParametrics: ParametricDescriptor<PoolSharedJointNode> = {
  groups: [
    {
      label: 'Connection',
      fields: [
        {
          key: 'connectionMode',
          kind: 'enum',
          options: ['open', 'submerged-shelf', 'spillover'],
        },
        { key: 'transitionDepth', kind: 'number', unit: 'm', min: 0.05, max: 2, step: 0.05, visibleIf: (node) => node.connectionMode !== 'open' },
        { key: 'transitionHeight', kind: 'number', unit: 'm', min: 0.05, max: 0.5, step: 0.01, visibleIf: (node) => node.connectionMode !== 'open' },
        { key: 'transitionColor', kind: 'color', visibleIf: (node) => node.connectionMode !== 'open' },
        { key: 'commonFloorDepth', kind: 'number', unit: 'm', min: 0.1, max: 4, step: 0.05 },
      ],
    },
    {
      label: 'Rock border',
      fields: [
        { key: 'rockWidth', kind: 'number', unit: 'm', min: 0.1, max: 1, step: 0.01 },
        { key: 'thickness', kind: 'number', unit: 'm', min: 0.02, max: 0.5, step: 0.01 },
        { key: 'surfaceColor', kind: 'color' },
        { key: 'rockSeed', kind: 'number', min: 0, max: 999999, step: 1 },
      ],
    },
    { label: 'Transform', fields: [{ key: 'position', kind: 'vec3' }] },
  ],
}
