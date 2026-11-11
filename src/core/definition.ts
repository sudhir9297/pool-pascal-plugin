import type { NodeDefinition } from '@pascal-app/core'
import { composeDefinition } from '../definition-compose'
import { poolEditContribution } from './definition.edit'
import { poolRenderDefinition } from './definition.render'
import type { PoolNode } from './schema'

type PoolDefinition = NodeDefinition<typeof PoolNode> & Record<string, unknown>

export { poolFloorplan } from './definition.render'

/** The full pool definition for editing hosts: render half + edit half. */
export const poolDefinition: PoolDefinition = composeDefinition(poolRenderDefinition, poolEditContribution)
