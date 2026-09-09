import type { ParametricDescriptor } from '@pascal-app/core'
import type { PoolFilterNode } from '../core/schema'
import { insertionDeletionHooks } from '../../editor/insertion-deletion'

export const poolFilterParametrics: ParametricDescriptor<PoolFilterNode> = {
  ...insertionDeletionHooks,
  trailingSection: () => import('../../editor/connections'),
  groups: [
    {
      label: 'Filter settings',
      fields: [
        { key: 'diameter', kind: 'number', unit: 'm', min: 0.25, max: 1.5, step: 0.01 },
        { key: 'bodyHeight', kind: 'number', unit: 'm', min: 0.35, max: 2, step: 0.01 },
        { key: 'portDiameter', kind: 'number', unit: 'm', min: 0.025, max: 0.15, step: 0.005 },
        { key: 'showGauge', kind: 'boolean' },
        { key: 'showFlow', kind: 'boolean' },
      ],
    },
    {
      label: 'Transform',
      fields: [{ key: 'position', kind: 'vec3' }, { key: 'rotation', kind: 'vec3' }],
    },
  ],
}
