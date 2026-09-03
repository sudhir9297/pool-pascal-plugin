import type { AnyNodeDefinition, Plugin } from '@pascal-app/core'
import { poolDefinition } from './swimming-pool/core/definition'
import { poolPipeDefinition } from './swimming-pool/pipe/core/definition'
import { poolSkimmerDefinition } from './swimming-pool/skimmer/core/definition'
import { poolValveDefinition } from './swimming-pool/valve/core/definition'
import { poolPumpDefinition } from './swimming-pool/pump/core/definition'
import { poolFilterDefinition } from './swimming-pool/filter/core/definition'
import { poolCatchBasinDefinition } from './swimming-pool/water-feature/basin/core/definition'
import { poolWatercourseDefinition } from './swimming-pool/water-feature/watercourse/core/definition'
import { poolHeaterDefinition } from './swimming-pool/heater/core/definition'
import { poolSharedJointDefinition } from './swimming-pool/shared-joint/core/definition'
import { poolSpilloverDefinition } from './swimming-pool/spillover/core/definition'
import { poolDrainDefinition } from './swimming-pool/drain/core/definition'
import { poolInletDefinition } from './swimming-pool/inlet/core/definition'
import { poolWaterfallDefinition } from './swimming-pool/water-feature/waterfall/core/definition'
import { poolStairDefinition } from './swimming-pool/stair/core/definition'

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
    poolFilterDefinition as unknown as AnyNodeDefinition,
    poolCatchBasinDefinition as unknown as AnyNodeDefinition,
    poolWatercourseDefinition as unknown as AnyNodeDefinition,
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
export { poolFilterDefinition } from './swimming-pool/filter/core/definition'
export { poolCatchBasinDefinition } from './swimming-pool/water-feature/basin/core/definition'
export { poolWatercourseDefinition } from './swimming-pool/water-feature/watercourse/core/definition'
export { poolHeaterDefinition } from './swimming-pool/heater/core/definition'
export { poolSharedJointDefinition } from './swimming-pool/shared-joint/core/definition'
export { poolSharedJointParametrics } from './swimming-pool/shared-joint/editor/parametrics'
export { poolSpilloverDefinition } from './swimming-pool/spillover/core/definition'
export { poolSpilloverParametrics } from './swimming-pool/spillover/editor/parametrics'
export { resolvePoolSpillover } from './swimming-pool/spillover/design/placement'
export { syncPoolSpillovers } from './swimming-pool/spillover/design/sync'
export { poolDrainDefinition } from './swimming-pool/drain/core/definition'
export { poolInletDefinition } from './swimming-pool/inlet/core/definition'
export { poolWaterfallDefinition } from './swimming-pool/water-feature/waterfall/core/definition'
export { poolWaterfallParametrics } from './swimming-pool/water-feature/waterfall/editor/parametrics'
export { findNearestWaterfallPlacement, placementOnPoolBoundary, resolveMountedWaterfall } from './swimming-pool/water-feature/waterfall/design/placement'
export { poolStairDefinition } from './swimming-pool/stair/core/definition'
export { PoolNode, resolvePoolPolygon } from './swimming-pool/core/schema'
export { PoolPipeNode } from './swimming-pool/pipe/core/schema'
export { PoolSkimmerNode } from './swimming-pool/skimmer/core/schema'
export { poolSkimmerParametrics } from './swimming-pool/skimmer/editor/parametrics'
export { PoolValveNode } from './swimming-pool/valve/core/schema'
export { poolValveParametrics } from './swimming-pool/valve/editor/parametrics'
export { PoolPumpNode } from './swimming-pool/pump/core/schema'
export { PoolFilterNode } from './swimming-pool/filter/core/schema'
export { PoolCatchBasinNode } from './swimming-pool/water-feature/basin/core/schema'
export { PoolWatercourseNode } from './swimming-pool/water-feature/watercourse/core/schema'
export { PoolHeaterNode } from './swimming-pool/heater/core/schema'
export { PoolSharedJointNode } from './swimming-pool/shared-joint/core/schema'
export { PoolSpilloverNode } from './swimming-pool/spillover/core/schema'
export { PoolDrainNode } from './swimming-pool/drain/core/schema'
export { PoolInletNode } from './swimming-pool/inlet/core/schema'
export { PoolWaterfallNode } from './swimming-pool/water-feature/waterfall/core/schema'
export { PoolStairNode } from './swimming-pool/stair/core/schema'
export { poolStairParametrics } from './swimming-pool/stair/editor/parametrics'
export { usePoolStairStore } from './swimming-pool/stair/editor/store'
export { POOL_STAIR_VARIANTS, POOL_STAIR_CATALOG, getPoolStairPreset } from './swimming-pool/stair/data/catalog'
export type { PoolStairVariant, PoolStairPreset } from './swimming-pool/stair/data/catalog'
export { resolvePoolStairMounting } from './swimming-pool/stair/design/mounting'
export type { PoolStairMounting } from './swimming-pool/stair/design/mounting'
export { findNearestPoolStairAttachment, poolStairAttachmentOnWall, poolStairAttachmentPatch, resolveMountedPoolStair } from './swimming-pool/stair/design/placement'
export type { PoolStairAttachment } from './swimming-pool/stair/design/placement'
export { findNearestInletConnection, findNearestInletWall, getInletPipeConnection, resolveMountedInlet } from './swimming-pool/inlet/design/placement'
export { poolInletParametrics } from './swimming-pool/inlet/editor/parametrics'
export { buildDrainGeometry, getDrainPortDirection, getDrainPortPosition } from './swimming-pool/drain/core/geometry'
export { poolDrainParametrics } from './swimming-pool/drain/editor/parametrics'
export { findNearestDrainConnection, getDrainPipeConnection } from './swimming-pool/drain/design/placement'
export { getPoolDrainPlacement } from './swimming-pool/drain/design/pool-placement'
export { poolHeaterParametrics } from './swimming-pool/heater/editor/parametrics'
export { poolFilterParametrics } from './swimming-pool/filter/editor/parametrics'
export { getFilterPortsLocal, getFilterPortPositions } from './swimming-pool/filter/core/geometry'
export type { FilterPort, FilterPortRole } from './swimming-pool/filter/core/geometry'
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
