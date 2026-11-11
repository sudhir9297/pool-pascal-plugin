import type { AnyNodeDefinition, Plugin } from '@pascal-app/core'
import { poolRenderDefinition } from './core/definition.render'
import { poolSkimmerRenderDefinition } from './skimmer/core/definition.render'
import { poolValveRenderDefinition } from './valve/core/definition.render'
import { poolPumpRenderDefinition } from './pump/core/definition.render'
import { poolFilterRenderDefinition } from './filter/core/definition.render'
import { poolHeaterRenderDefinition } from './heater/core/definition.render'
import { poolSharedJointRenderDefinition } from './shared-joint/core/definition.render'
import { poolSpilloverRenderDefinition } from './spillover/core/definition.render'
import { poolDrainRenderDefinition } from './drain/core/definition.render'
import { poolInletRenderDefinition } from './inlet/core/definition.render'
import { poolWaterfallRenderDefinition } from './water-feature/waterfall/core/definition.render'
import { poolStairRenderDefinition } from './stair/core/definition.render'

/**
 * Render-only entry (`@pascal-app/plugin-pool/render`) for read-only viewers.
 * Same plugin id, contract version, kinds, schemas, versions and defaults as
 * `poolPlugin`, with the geometry, renderers, materials, animated water, opening
 * system, ports, plans and export animation, and none of the editing parts
 * (paint, placement tools and previews, handles, plan move and outline editing,
 * parameters, keyboard actions, the Pools panel), so it never loads
 * `@pascal-app/editor`. Load one entry or the other, not both.
 * `bun run check:render` holds that boundary.
 */
export const poolRenderPlugin: Plugin = {
  id: 'pascal:pool',
  apiVersion: 1,
  nodes: [
    poolRenderDefinition as unknown as AnyNodeDefinition,
    poolSkimmerRenderDefinition as unknown as AnyNodeDefinition,
    poolValveRenderDefinition as unknown as AnyNodeDefinition,
    poolPumpRenderDefinition as unknown as AnyNodeDefinition,
    poolFilterRenderDefinition as unknown as AnyNodeDefinition,
    poolHeaterRenderDefinition as unknown as AnyNodeDefinition,
    poolSharedJointRenderDefinition as unknown as AnyNodeDefinition,
    poolSpilloverRenderDefinition as unknown as AnyNodeDefinition,
    poolDrainRenderDefinition as unknown as AnyNodeDefinition,
    poolInletRenderDefinition as unknown as AnyNodeDefinition,
    poolWaterfallRenderDefinition as unknown as AnyNodeDefinition,
    poolStairRenderDefinition as unknown as AnyNodeDefinition,
  ],
}

// No re-export from './core/geometry': it touches `document` at module scope.
export {
  poolRenderDefinition,
  poolSkimmerRenderDefinition,
  poolValveRenderDefinition,
  poolPumpRenderDefinition,
  poolFilterRenderDefinition,
  poolHeaterRenderDefinition,
  poolSharedJointRenderDefinition,
  poolSpilloverRenderDefinition,
  poolDrainRenderDefinition,
  poolInletRenderDefinition,
  poolWaterfallRenderDefinition,
  poolStairRenderDefinition,
}
export { PoolNode, resolvePoolPolygon } from './core/schema'
export { PoolSkimmerNode } from './skimmer/core/schema'
export { PoolValveNode } from './valve/core/schema'
export { PoolPumpNode } from './pump/core/schema'
export { PoolFilterNode } from './filter/core/schema'
export { PoolHeaterNode } from './heater/core/schema'
export { PoolSharedJointNode } from './shared-joint/core/schema'
export { PoolSpilloverNode } from './spillover/core/schema'
export { PoolDrainNode } from './drain/core/schema'
export { PoolInletNode } from './inlet/core/schema'
export { PoolWaterfallNode } from './water-feature/waterfall/core/schema'
export { PoolStairNode } from './stair/core/schema'
