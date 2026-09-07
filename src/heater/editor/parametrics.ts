import type { ParametricDescriptor } from '@pascal-app/core'
import type { PoolHeaterNode } from '../core/schema'

export const poolHeaterParametrics: ParametricDescriptor<PoolHeaterNode> = {
  groups: [
    {
      label: 'Heater settings',
      fields: [
        { key: 'technology', kind: 'enum', options: ['gas', 'electric', 'heat-pump'], display: 'segmented' },
        { key: 'bodyWidth', kind: 'number', unit: 'm', min: 0.3, max: 2, step: 0.01 },
        { key: 'bodyHeight', kind: 'number', unit: 'm', min: 0.35, max: 2, step: 0.01 },
        { key: 'bodyDepth', kind: 'number', unit: 'm', min: 0.3, max: 1.5, step: 0.01 },
        { key: 'portDiameter', kind: 'number', unit: 'm', min: 0.025, max: 0.15, step: 0.005 },
        { key: 'showExhaust', kind: 'boolean' },
        { key: 'showFlow', kind: 'boolean' },
      ],
    },
    {
      label: 'Transform',
      fields: [{ key: 'position', kind: 'vec3' }, { key: 'rotation', kind: 'vec3' }],
    },
  ],
}
