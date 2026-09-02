import type { AnyNodeDefinition, Plugin } from '@pascal-app/core'
import { poolDefinition } from './swimming-pool/core/definition'

/**
 * The pool plugin manifest — the entire public surface of this package. A host
 * loads it through the same `loadPlugin` path the built-ins use: one pool node
 * kind and one optional editor panel. Cast mirrors the built-in bundle: `AnyNodeDefinition` is the
 * hand-maintained union today; the registry derives it post-migration.
 */
export const poolPlugin: Plugin = {
  id: 'pascal:pool',
  apiVersion: 1,
  nodes: [
    poolDefinition as unknown as AnyNodeDefinition,
  ],
}

export const poolHostPanel: PoolHostPanel = {
  id: 'pascal:pool:catalog',
  label: 'Pools',
  icon: { kind: 'iconify', name: 'lucide:waves' },
  component: () => import('./swimming-pool/editor/panel'),
  pluginId: poolPlugin.id,
  description: 'Design and place swimming pools with animated water.',
  creator: {
    name: 'Pascal',
    url: 'https://github.com/pascalorg',
  },
  pluginUrl: 'https://github.com/pascalorg/plugin-pool',
  defaultInstalled: true,
}

// NOTE: no re-export from './swimming-pool/core/geometry' — it imports the client-only geometry
// `document` at module scope and would crash SSR (this barrel is eagerly
// imported by host bootstraps). Lazy client modules import it directly.
export { poolDefinition } from './swimming-pool/core/definition'
export { PoolNode, resolvePoolPolygon } from './swimming-pool/core/schema'
export { poolParametrics } from './swimming-pool/editor/parametrics'
export { usePoolStore } from './swimming-pool/editor/store'
export {
  POOL_SHAPES,
  POOL_SHAPE_OPTIONS,
  createPoolShapePolygon,
  isDrawnPoolShape,
  sampleClosedPoolSpline,
  type PoolShape,
} from './swimming-pool/design/shapes'
export {
  advanceFreehandPoolStroke,
  buildFreehandPoolOutline,
  type FreehandPoolOutline,
} from './swimming-pool/design/freehand-outline'
export { WATER_PRESETS, WATER_PRESET_SETTINGS, getWaterPresetSettings } from './swimming-pool/shader/water-presets'
type PoolHostPanel = {
  id: string
  pluginId: string
  label: string
  description: string
  creator: { name: string; url?: string }
  pluginUrl: string
  icon: { kind: 'iconify'; name: string }
  component: () => Promise<{ default: React.ComponentType }>
  defaultInstalled: boolean
}
