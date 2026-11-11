import type { NodeDefinition } from '@pascal-app/core'
import { composeDefinition } from '../../definition-compose'
import { poolValveEditContribution } from './definition.edit'
import { poolValveRenderDefinition } from './definition.render'
import type { PoolValveNode } from './schema'

export const poolValveDefinition: NodeDefinition<typeof PoolValveNode> = composeDefinition(
  poolValveRenderDefinition,
  poolValveEditContribution,
)
