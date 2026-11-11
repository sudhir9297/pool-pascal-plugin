import type { NodeDefinition } from '@pascal-app/core'
import { composeDefinition } from '../../definition-compose'
import { poolDrainEditContribution } from './definition.edit'
import { poolDrainRenderDefinition } from './definition.render'
import type { PoolDrainNode } from './schema'

export const poolDrainDefinition: NodeDefinition<typeof PoolDrainNode> = composeDefinition(
  poolDrainRenderDefinition,
  poolDrainEditContribution,
)
