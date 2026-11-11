import type { NodeDefinition } from '@pascal-app/core'
import { composeDefinition } from '../../definition-compose'
import { poolSkimmerEditContribution } from './definition.edit'
import { poolSkimmerRenderDefinition } from './definition.render'
import type { PoolSkimmerNode } from './schema'

export const poolSkimmerDefinition: NodeDefinition<typeof PoolSkimmerNode> = composeDefinition(
  poolSkimmerRenderDefinition,
  poolSkimmerEditContribution,
)
