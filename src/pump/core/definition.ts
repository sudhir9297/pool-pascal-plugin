import type { NodeDefinition } from '@pascal-app/core'
import { composeDefinition } from '../../definition-compose'
import { poolPumpEditContribution } from './definition.edit'
import { poolPumpRenderDefinition } from './definition.render'
import type { PoolPumpNode } from './schema'

export const poolPumpDefinition: NodeDefinition<typeof PoolPumpNode> = composeDefinition(
  poolPumpRenderDefinition,
  poolPumpEditContribution,
)
