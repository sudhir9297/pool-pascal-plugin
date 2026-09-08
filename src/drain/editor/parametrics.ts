import type { ParametricDescriptor } from '@pascal-app/core'
import type { PoolDrainNode } from '../core/schema'

export const poolDrainParametrics: ParametricDescriptor<PoolDrainNode> = {
  trailingSection: () => import('../../editor/connections'),
  groups: [
    {
      label: 'Drain settings',
      fields: [
        { key: 'style', kind: 'enum', options: ['round', 'square'], display: 'segmented' },
        { key: 'diameter', kind: 'number', unit: 'm', min: 0.025, max: 0.15, step: 0.005 },
        { key: 'grateDiameter', kind: 'number', unit: 'm', min: 0.08, max: 0.6, step: 0.01 },
        { key: 'bodyDepth', kind: 'number', unit: 'm', min: 0.02, max: 0.3, step: 0.01 },
        { key: 'showFlow', kind: 'boolean' },
      ],
    },
    { label: 'Transform', fields: [{ key: 'position', kind: 'vec3' }, { key: 'rotation', kind: 'vec3' }] },
  ],
}
