import type { NodeDefinition } from '@pascal-app/core'
import { composeDefinition } from '../../../definition-compose'
import { poolWaterfallEditContribution } from './definition.edit'
import { poolWaterfallRenderDefinition } from './definition.render'
import type { PoolWaterfallNode } from './schema'

export const poolWaterfallDefinition: NodeDefinition<typeof PoolWaterfallNode> = composeDefinition(
  poolWaterfallRenderDefinition,
  poolWaterfallEditContribution,
)
