import type { NodeDefinition } from '@pascal-app/core'
import { composeDefinition } from '../../definition-compose'
import { poolInletEditContribution } from './definition.edit'
import { poolInletRenderDefinition } from './definition.render'
import type { PoolInletNode } from './schema'

export const poolInletDefinition: NodeDefinition<typeof PoolInletNode> = composeDefinition(
  poolInletRenderDefinition,
  poolInletEditContribution,
)
