import type { AnyNodeDefinition, Plugin } from '@pascal-app/core'
import { poolDefinition } from './swimming-pool/core/definition'
import { poolPipeDefinition } from './swimming-pool/pipe/core/definition'
import { poolSkimmerDefinition } from './swimming-pool/skimmer/core/definition'
import { poolValveDefinition } from './swimming-pool/valve/core/definition'
import { poolPumpDefinition } from './swimming-pool/pump/core/definition'

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
    poolPipeDefinition as unknown as AnyNodeDefinition,
    poolSkimmerDefinition as unknown as AnyNodeDefinition,
    poolValveDefinition as unknown as AnyNodeDefinition,
    poolPumpDefinition as unknown as AnyNodeDefinition,
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
export { poolPipeDefinition } from './swimming-pool/pipe/core/definition'
export { poolSkimmerDefinition } from './swimming-pool/skimmer/core/definition'
export { poolValveDefinition } from './swimming-pool/valve/core/definition'
export { poolPumpDefinition } from './swimming-pool/pump/core/definition'
export { PoolNode, resolvePoolPolygon } from './swimming-pool/core/schema'
export { PoolPipeNode } from './swimming-pool/pipe/core/schema'
export { PoolSkimmerNode } from './swimming-pool/skimmer/core/schema'
export { PoolValveNode } from './swimming-pool/valve/core/schema'
export { PoolPumpNode } from './swimming-pool/pump/core/schema'
export { POOL_FILTER_CATALOG, getPoolFilterData } from './swimming-pool/filter/data/catalog'
export type { PoolFilterData, PoolFilterTechnology } from './swimming-pool/filter/data/types'
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
export { POOL_FINISHES, POOL_FINISH_SETTINGS, getPoolFinishSettings } from './swimming-pool/design/pool-finishes'
export {
  POOL_VISUAL_PRESETS,
  POOL_VISUAL_PRESETS_SETTINGS,
  getPoolVisualPreset,
  type PoolVisualPreset,
} from './swimming-pool/design/visual-presets'
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
