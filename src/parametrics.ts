import { type AnyNodeId, type ParametricDescriptor, useScene } from '@pascal-app/core'
import { defaultHeightOf, POOL_SEED_POOL } from './presets'
import type { PoolNode } from './schema'

/**
 * The pool's right-hand inspector. This descriptor is the entire inspector —
 * the host's `ParametricInspector` renders every control (selects, sliders,
 * segmented switches, the native colour pickers, the vec3, and the Randomize
 * action) with zero pool-specific code in the editor. Demonstrates the "right
 * inspector comes free from `def.parametrics`" leg of the plugin surface.
 *
 * Colours (`waterColor`/`copingColor`) are edit-only — they're not on the
 * placement brush, so a placed pool starts neutral (texture colours) and is
 * tinted here per-pool.
 */
export const poolParametrics: ParametricDescriptor<PoolNode> = {
  groups: [
    {
      label: 'Pool',
      fields: [
        {
          key: 'preset',
          kind: 'enum',
          options: ['lap', 'family', 'infinity', 'plunge', 'courtyard', 'spa'],
        },
        {
          key: 'size',
          kind: 'enum',
          options: ['small', 'medium', 'large'],
          display: 'segmented',
          visibleIf: (n) => n.preset !== 'spa',
        },
        {
          key: 'waterProfile',
          kind: 'enum',
          options: ['chlorinated', 'saltwater'],
          display: 'segmented',
        },
        { key: 'height', kind: 'number', unit: 'm', min: 1, max: 15, step: 0.5 },
        { key: 'copingColor', kind: 'color' },
        { key: 'seed', kind: 'number', min: 0, max: 9999, step: 1 },
      ],
    },
    {
      label: 'Construction',
      fields: [
        { key: 'minimal', kind: 'boolean' },
        {
          key: 'detailDensity',
          kind: 'number',
          min: 0,
          max: 1.5,
          step: 0.1,
          visibleIf: (n) => !n.minimal,
        },
        { key: 'wallThickness', kind: 'number', min: 0.3, max: 2.5, step: 0.1 },
        { key: 'waterColor', kind: 'color', visibleIf: (n) => !n.minimal },
      ],
    },
    {
      label: 'Position',
      fields: [{ key: 'position', kind: 'vec3' }],
    },
  ],
  actions: [
    {
      label: 'Randomize',
      // The action receives the live node; writing a new seed re-generates the
      // pool. Pick from the bounded pool so the result stays an instancing
      // variant shared with other pools, not a one-off mesh.
      onClick: (n) =>
        useScene.getState().updateNode(
          n.id as AnyNodeId,
          {
            seed: POOL_SEED_POOL[Math.floor(Math.random() * POOL_SEED_POOL.length)] ?? 1,
          } as Partial<PoolNode> as never,
        ),
    },
    {
      label: 'Reset height',
      // Snap height back to the preset+size default (handy after changing size).
      onClick: (n) =>
        useScene
          .getState()
          .updateNode(
            n.id as AnyNodeId,
            { height: defaultHeightOf(n.preset, n.size) } as Partial<PoolNode> as never,
          ),
    },
  ],
}
