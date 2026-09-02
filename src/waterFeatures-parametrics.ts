import type { ParametricDescriptor } from '@pascal-app/core'
import type { WaterFeaturesNode } from './waterFeatures-schema'

/** Inspector for a placed waterFeatures feature — rendered for free by the host's
 * `ParametricInspector` from this descriptor. */
export const waterFeaturesParametrics: ParametricDescriptor<WaterFeaturesNode> = {
  groups: [
    {
      label: 'WaterFeatures',
      fields: [
        { key: 'preset', kind: 'enum', options: ['fountain', 'spillway', 'cascade'] },
        { key: 'height', kind: 'number', unit: 'm', min: 0.1, max: 2, step: 0.05 },
        { key: 'waterColor', kind: 'color' },
        { key: 'seed', kind: 'number', min: 0, max: 9999, step: 1 },
      ],
    },
    {
      label: 'Position',
      fields: [{ key: 'position', kind: 'vec3' }],
    },
  ],
}
