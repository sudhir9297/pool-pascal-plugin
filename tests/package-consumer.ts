import {
  PoolDrainNode,
  PoolFilterNode,
  PoolHeaterNode,
  PoolInletNode,
  PoolNode,
  PoolPumpNode,
  PoolSharedJointNode,
  PoolSkimmerNode,
  PoolSpilloverNode,
  PoolStairNode,
  PoolValveNode,
  PoolWaterfallNode,
  createPoolShapePolygon,
  poolPlugin,
  type PoolShape,
} from '@pascal-app/plugin-pool'

const shape: PoolShape = 'rectangle'
const polygon = createPoolShapePolygon(shape, 8, 4)
const nodes = [
  PoolNode.parse({}),
  PoolDrainNode.parse({}),
  PoolFilterNode.parse({}),
  PoolHeaterNode.parse({}),
  PoolInletNode.parse({}),
  PoolPumpNode.parse({}),
  PoolSharedJointNode.parse({ poolIds: ['pool_a', 'pool_b'] }),
  PoolSkimmerNode.parse({}),
  PoolSpilloverNode.parse({ sourcePoolId: 'pool_a', targetPoolId: 'pool_b' }),
  PoolStairNode.parse({}),
  PoolValveNode.parse({}),
  PoolWaterfallNode.parse({}),
]

export const packageContract: {
  pluginId: string
  nodeCount: number
  polygonPoints: number
} = {
  pluginId: poolPlugin.id,
  nodeCount: nodes.length,
  polygonPoints: polygon.length,
}
