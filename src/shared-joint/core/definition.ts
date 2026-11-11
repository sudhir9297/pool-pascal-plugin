import type { NodeDefinition } from '@pascal-app/core'
import { composeDefinition } from '../../definition-compose'
import { poolSharedJointEditContribution } from './definition.edit'
import { poolSharedJointRenderDefinition } from './definition.render'
import type { PoolSharedJointNode } from './schema'

export const poolSharedJointDefinition: NodeDefinition<typeof PoolSharedJointNode> = composeDefinition(
  poolSharedJointRenderDefinition,
  poolSharedJointEditContribution,
)
