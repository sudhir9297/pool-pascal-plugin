import type { AnyNodeDefinition, Plugin } from '@pascal-app/core'
import { poolDefinition } from './core/definition'
import { poolSkimmerDefinition } from './skimmer/core/definition'
import { poolValveDefinition } from './valve/core/definition'
import { poolPumpDefinition } from './pump/core/definition'
import { poolFilterDefinition } from './filter/core/definition'
import { poolHeaterDefinition } from './heater/core/definition'
import { poolSharedJointDefinition } from './shared-joint/core/definition'
import { poolSpilloverDefinition } from './spillover/core/definition'
import { poolDrainDefinition } from './drain/core/definition'
import { poolInletDefinition } from './inlet/core/definition'
import { poolWaterfallDefinition } from './water-feature/waterfall/core/definition'
import { poolStairDefinition } from './stair/core/definition'

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
    poolSkimmerDefinition as unknown as AnyNodeDefinition,
    poolValveDefinition as unknown as AnyNodeDefinition,
    poolPumpDefinition as unknown as AnyNodeDefinition,
    poolFilterDefinition as unknown as AnyNodeDefinition,
    poolHeaterDefinition as unknown as AnyNodeDefinition,
    poolSharedJointDefinition as unknown as AnyNodeDefinition,
    poolSpilloverDefinition as unknown as AnyNodeDefinition,
    poolDrainDefinition as unknown as AnyNodeDefinition,
    poolInletDefinition as unknown as AnyNodeDefinition,
    poolWaterfallDefinition as unknown as AnyNodeDefinition,
    poolStairDefinition as unknown as AnyNodeDefinition,
  ],
}

export const poolHostPanel: PoolHostPanel = {
  id: 'pascal:pool:catalog',
  label: 'Pools',
  icon: { kind: 'iconify', name: 'lucide:waves' },
  component: () => import('./editor/panel'),
  pluginId: poolPlugin.id,
  description: 'Design and place swimming pools with animated water.',
  creator: {
    name: 'Pascal',
    url: 'https://github.com/pascalorg',
  },
  pluginUrl: 'https://github.com/pascalorg/plugin-pool',
  defaultInstalled: true,
}

// NOTE: no re-export from './core/geometry' — it imports the client-only geometry
// `document` at module scope and would crash SSR (this barrel is eagerly
// imported by host bootstraps). Lazy client modules import it directly.
export { poolDefinition } from './core/definition'
export { planDwvConnection } from './core/dwv-connection'
export { poolSkimmerDefinition } from './skimmer/core/definition'
export { poolValveDefinition } from './valve/core/definition'
export { poolPumpDefinition } from './pump/core/definition'
export { poolFilterDefinition } from './filter/core/definition'
export { poolHeaterDefinition } from './heater/core/definition'
export { poolSharedJointDefinition } from './shared-joint/core/definition'
export { poolSharedJointParametrics } from './shared-joint/editor/parametrics'
export { poolSpilloverDefinition } from './spillover/core/definition'
export { poolSpilloverParametrics } from './spillover/editor/parametrics'
export { resolvePoolSpillover } from './spillover/design/placement'
export { syncPoolSpillovers } from './spillover/design/sync'
export { poolDrainDefinition } from './drain/core/definition'
export { poolInletDefinition } from './inlet/core/definition'
export { poolWaterfallDefinition } from './water-feature/waterfall/core/definition'
export { poolWaterfallParametrics } from './water-feature/waterfall/editor/parametrics'
export { createStandaloneWaterfallPlacement, findNearestWaterfallPlacement, placementOnPoolBoundary, resolveMountedWaterfall } from './water-feature/waterfall/design/placement'
export { poolStairDefinition } from './stair/core/definition'
export { PoolNode, resolvePoolPolygon } from './core/schema'
export { PoolSkimmerNode } from './skimmer/core/schema'
export { poolSkimmerParametrics } from './skimmer/editor/parametrics'
export { PoolValveNode } from './valve/core/schema'
export { poolValveParametrics } from './valve/editor/parametrics'
export { PoolPumpNode } from './pump/core/schema'
export { PoolFilterNode } from './filter/core/schema'
export { PoolHeaterNode } from './heater/core/schema'
export { PoolSharedJointNode } from './shared-joint/core/schema'
export { PoolSpilloverNode } from './spillover/core/schema'
export { PoolDrainNode } from './drain/core/schema'
export { PoolInletNode } from './inlet/core/schema'
export { PoolWaterfallNode } from './water-feature/waterfall/core/schema'
export { PoolStairNode } from './stair/core/schema'
export { poolStairParametrics } from './stair/editor/parametrics'
export { usePoolStairStore } from './stair/editor/store'
export { POOL_STAIR_VARIANTS, POOL_STAIR_CATALOG, getPoolStairPreset } from './stair/data/catalog'
export type { PoolStairVariant, PoolStairPreset } from './stair/data/catalog'
export { resolvePoolStairMounting } from './stair/design/mounting'
export type { PoolStairMounting } from './stair/design/mounting'
export { findNearestPoolStairAttachment, poolStairAttachmentOnWall, poolStairAttachmentPatch, resolveMountedPoolStair } from './stair/design/placement'
export type { PoolStairAttachment } from './stair/design/placement'
export { findNearestInletWall, resolveMountedInlet } from './inlet/design/placement'
export { poolInletParametrics } from './inlet/editor/parametrics'
export { buildDrainGeometry, getDrainPortDirection, getDrainPortPosition } from './drain/core/geometry'
export { poolDrainParametrics } from './drain/editor/parametrics'
export { getPoolDrainPlacement } from './drain/design/pool-placement'
export { poolHeaterParametrics } from './heater/editor/parametrics'
export { poolFilterParametrics } from './filter/editor/parametrics'
export { getFilterPortsLocal, getFilterPortPositions } from './filter/core/geometry'
export type { FilterPort, FilterPortRole } from './filter/core/geometry'
export { POOL_FILTER_CATALOG, getPoolFilterData } from './filter/data/catalog'
export type { PoolFilterData, PoolFilterTechnology } from './filter/data/types'
export { poolParametrics } from './editor/parametrics'
export { usePoolStore } from './editor/store'
export {
  POOL_SHAPES,
  POOL_SHAPE_OPTIONS,
  createPoolShapePolygon,
  isDrawnPoolShape,
  sampleClosedPoolSpline,
  type PoolShape,
} from './design/shapes'
export {
  advanceFreehandPoolStroke,
  buildFreehandPoolOutline,
  type FreehandPoolOutline,
} from './design/freehand-outline'
export { WATER_PRESETS, WATER_PRESET_SETTINGS, getWaterPresetSettings } from './shader/water-presets'
export { POOL_FINISHES, POOL_FINISH_SETTINGS, getPoolFinishSettings } from './design/pool-finishes'
export {
  POOL_VISUAL_PRESETS,
  POOL_VISUAL_PRESETS_SETTINGS,
  getPoolVisualPreset,
  type PoolVisualPreset,
} from './design/visual-presets'
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
