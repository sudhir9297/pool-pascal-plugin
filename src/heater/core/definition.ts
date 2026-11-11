import type { NodeDefinition } from '@pascal-app/core'
import { composeDefinition } from '../../definition-compose'
import { poolHeaterEditContribution } from './definition.edit'
import { poolHeaterRenderDefinition } from './definition.render'
import type { PoolHeaterNode } from './schema'

export const poolHeaterDefinition: NodeDefinition<typeof PoolHeaterNode> = composeDefinition(
  poolHeaterRenderDefinition,
  poolHeaterEditContribution,
)
