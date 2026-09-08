import type { ParametricDescriptor } from '@pascal-app/core'
import type { PoolValveNode } from '../core/schema'

export const poolValveParametrics: ParametricDescriptor<PoolValveNode> = {
  trailingSection: () => import('../../editor/connections'),
  groups: [
    {
      label: 'Valve settings',
      fields: [
        { key: 'variant', kind: 'enum', options: ['two-way', 'three-way'], display: 'segmented' },
        { key: 'diameter', kind: 'number', unit: 'm', min: 0.025, max: 0.15, step: 0.005 },
        { key: 'flowPattern', kind: 'enum', options: ['open', 'closed', 'left-right', 'left-branch', 'all', 'right-branch'] },
      ],
    },
    {
      label: 'Position',
      fields: [{ key: 'position', kind: 'vec3' }],
    },
    {
      label: 'Rotation',
      fields: [{ key: 'rotation', kind: 'vec3' }],
    },
  ],
  derive: (next, patch) => {
    if (!('flowPattern' in patch)) return {}
    const handleAngles: Record<PoolValveNode['flowPattern'], number> = {
      open: 0,
      closed: Math.PI,
      'left-right': 0,
      'left-branch': -Math.PI / 2,
      all: 0,
      'right-branch': Math.PI / 2,
    }
    return { handleAngle: handleAngles[next.flowPattern] }
  },
}
