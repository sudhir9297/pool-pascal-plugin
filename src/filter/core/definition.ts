import type { NodeDefinition } from '@pascal-app/core'
import { composeDefinition } from '../../definition-compose'
import { poolFilterEditContribution } from './definition.edit'
import { poolFilterRenderDefinition } from './definition.render'
import type { PoolFilterNode } from './schema'

export const poolFilterDefinition: NodeDefinition<typeof PoolFilterNode> = composeDefinition(
  poolFilterRenderDefinition,
  poolFilterEditContribution,
)
