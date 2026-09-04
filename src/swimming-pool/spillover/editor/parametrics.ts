import type { ParametricDescriptor } from '@pascal-app/core'
import type { PoolSpilloverNode } from '../core/schema'

export const poolSpilloverParametrics: ParametricDescriptor<PoolSpilloverNode> = {
  groups: [
    {
      label: 'Spillover',
      fields: [
        { key: 'connectionStyle', kind: 'enum', options: ['auto', 'direct-spillover', 'watercourse'], display: 'segmented' },
        { key: 'width', kind: 'number', unit: 'm', min: 0.3, max: 12, step: 0.05 },
        { key: 'dropHeight', kind: 'number', unit: 'm', min: 0.02, max: 6, step: 0.05 },
        { key: 'lipThickness', kind: 'number', unit: 'm', min: 0.02, max: 0.3, step: 0.01 },
        { key: 'flowStrength', kind: 'number', min: 0.2, max: 2, step: 0.05 },
        { key: 'waterColor', kind: 'color' },
        { key: 'surfaceColor', kind: 'color' },
      ],
    },
  ],
}
