import type { ParametricDescriptor } from '@pascal-app/core'
import type { PoolStairNode } from '../core/schema'

export const poolStairParametrics: ParametricDescriptor<PoolStairNode> = {
  groups: [
    { label: 'Pool ladder', fields: [
      { key: 'variant', kind: 'enum', options: ['extended', 'classic', 'square', 'compact'], display: 'segmented' },
      { key: 'stepCount', kind: 'number', min: 2, max: 6, step: 1 },
      { key: 'width', kind: 'number', unit: 'm', min: 0.3, max: 2.5, step: 0.01 },
      { key: 'depth', kind: 'number', unit: 'm', min: 0.5, max: 4, step: 0.01 },
      { key: 'treadDepth', kind: 'number', unit: 'm', min: 0.12, max: 0.6, step: 0.01 },
    ] },
    { label: 'Material', fields: [
      { key: 'tubeDiameter', kind: 'number', unit: 'm', min: 0.02, max: 0.1, step: 0.001 },
      { key: 'metalColor', kind: 'color' },
    ] },
    { label: 'Wall attachment', fields: [
      { key: 'wallIndex', kind: 'number', min: 0, max: 100, step: 1 },
      { key: 'wallT', kind: 'number', min: 0, max: 1, step: 0.01 },
    ] },
    { label: 'Position (X / Y / Z)', fields: [{ key: 'position', kind: 'vec3' }] },
    { label: 'Rotation (X / Y / Z)', fields: [{ key: 'rotation', kind: 'vec3' }] },
  ],
}
