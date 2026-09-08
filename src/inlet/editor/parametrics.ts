import type { ParametricDescriptor } from '@pascal-app/core'
import type { PoolInletNode } from '../core/schema'

export const poolInletParametrics: ParametricDescriptor<PoolInletNode> = {
  trailingSection: () => import('../../editor/connections'),
  groups: [
    {
      label: 'Inlet settings',
      fields: [
        { key: 'nozzleDiameter', kind: 'number', unit: 'm', min: 0.025, max: 0.15, step: 0.005 },
        { key: 'flangeRadius', kind: 'number', unit: 'm', min: 0.06, max: 0.3, step: 0.01 },
        { key: 'bodyDepth', kind: 'number', unit: 'm', min: 0.06, max: 0.5, step: 0.01 },
      ],
    },
    {
      label: 'Water flow',
      fields: [
        { key: 'showFlow', kind: 'boolean' },
        { key: 'flowLength', kind: 'number', unit: 'm', min: 0.05, max: 1, step: 0.01 },
      ],
    },
    {
      label: 'Wall attachment',
      fields: [
        { key: 'wallIndex', kind: 'number', min: 0, max: 100, step: 1 },
        { key: 'wallT', kind: 'number', min: 0, max: 1, step: 0.01 },
        { key: 'verticalOffset', kind: 'number', unit: 'm', min: -3, max: 0.5, step: 0.01 },
      ],
    },
    { label: 'Position', fields: [{ key: 'position', kind: 'vec3' }] },
    { label: 'Rotation', fields: [{ key: 'rotation', kind: 'vec3' }] },
  ],
}
