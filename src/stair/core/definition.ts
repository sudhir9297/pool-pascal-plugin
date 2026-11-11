import type { NodeDefinition } from '@pascal-app/core'
import { composeDefinition } from '../../definition-compose'
import { poolStairEditContribution } from './definition.edit'
import { poolStairRenderDefinition } from './definition.render'
import type { PoolStairNode } from './schema'

export const poolStairDefinition: NodeDefinition<typeof PoolStairNode> = composeDefinition(
  poolStairRenderDefinition,
  poolStairEditContribution,
)
