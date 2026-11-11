import type { AnyNodeId } from '@pascal-app/core'
import type { PoolSharedJointNode } from './schema'
import { poolSharedJointParametrics } from '../editor/parametrics'
import type { PoolEditContribution } from '../../definition-compose'

export const poolSharedJointEditContribution: PoolEditContribution<typeof PoolSharedJointNode> = {
  snapProfile: 'item',
  floorplanDependencies: (node) => node.poolIds as AnyNodeId[],
  parametrics: poolSharedJointParametrics,
}
