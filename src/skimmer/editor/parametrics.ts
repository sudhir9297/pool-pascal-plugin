import type { ParametricDescriptor } from '@pascal-app/core'
import type { PoolSkimmerNode } from '../core/schema'

export const poolSkimmerParametrics: ParametricDescriptor<PoolSkimmerNode> = {
  trailingSection: () => import('../../editor/connections'),
  groups: [
    {
      label: 'Skimmer appearance',
      fields: [
        { key: 'style', kind: 'enum', options: ['standard', 'wide-mouth', 'corner'], display: 'segmented' },
        { key: 'bodyWidth', kind: 'number', unit: 'm', min: 0.25, max: 2, step: 0.01 },
        { key: 'bodyHeight', kind: 'number', unit: 'm', min: 0.25, max: 1.5, step: 0.01 },
        { key: 'mouthWidth', kind: 'number', unit: 'm', min: 0.15, max: 1.5, step: 0.01 },
        { key: 'mouthHeight', kind: 'number', unit: 'm', min: 0.05, max: 0.5, step: 0.01 },
        { key: 'accessState', kind: 'enum', options: ['closed', 'open'], display: 'segmented' },
      ],
    },
    {
      label: 'Water and plumbing',
      fields: [
        { key: 'showFlow', kind: 'boolean' },
        { key: 'suctionDiameter', kind: 'number', unit: 'm', min: 0.025, max: 0.15, step: 0.005 },
      ],
    },
    {
      label: 'Wall attachment',
      fields: [
        { key: 'wallIndex', kind: 'number', min: 0, max: 100, step: 1 },
        { key: 'wallT', kind: 'number', min: 0, max: 1, step: 0.01 },
      ],
    },
    {
      label: 'Position change (X / Y / Z)',
      fields: [{ key: 'position', kind: 'vec3' }],
    },
    {
      label: 'Rotation (X / Y / Z)',
      fields: [{ key: 'rotation', kind: 'vec3' }],
    },
  ],
}
