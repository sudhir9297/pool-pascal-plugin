import type { NodeDefinition } from '@pascal-app/core'
import { composeDefinition } from '../../definition-compose'
import { poolSpilloverEditContribution } from './definition.edit'
import { poolSpilloverRenderDefinition } from './definition.render'
import type { PoolSpilloverNode } from './schema'

export { poolSpilloverFloorplan } from './definition.render'

export const poolSpilloverDefinition: NodeDefinition<typeof PoolSpilloverNode> = composeDefinition(
  poolSpilloverRenderDefinition,
  poolSpilloverEditContribution,
)
