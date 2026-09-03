import { describe, expect, test } from 'bun:test'
import { poolCatchBasinDefinition, poolHostPanel, poolPlugin, PoolCatchBasinNode, PoolInletNode, PoolNode, PoolPipeNode, PoolSharedJointNode, PoolSkimmerNode, PoolValveNode, PoolPumpNode, PoolFilterNode, PoolWatercourseNode, PoolWaterfallNode, PoolStairNode } from './index'

describe('Swimming pool plugin manifest', () => {
  test('exports the stable plugin identity and node kinds', () => {
    expect(poolPlugin.id).toBe('pascal:pool')
    expect(poolPlugin.apiVersion).toBe(1)
    expect(poolPlugin.nodes?.map((definition) => definition.kind)).toEqual(['pool:pool', 'pool:pipe-network', 'pool:skimmer', 'pool:valve', 'pool:pump', 'pool:filter', 'pool:catch-basin', 'pool:watercourse', 'pool:heater', 'pool:shared-joint', 'pool:drain', 'pool:inlet', 'pool:waterfall', 'pool:stair'])
  })

  test('associates the Pool panel with the plugin', () => {
    expect(poolHostPanel.pluginId).toBe(poolPlugin.id)
    expect(poolHostPanel.defaultInstalled).toBe(true)
    expect(poolHostPanel.pluginUrl).toBe('https://github.com/pascalorg/plugin-pool')
  })

  test('ships valid defaults for every contributed node schema', () => {
    expect(PoolNode.parse({}).type).toBe('pool:pool')
    expect(PoolStairNode.parse({}).type).toBe('pool:stair')
  })

  test('accepts the pool-owned rock border mode', () => {
    expect(PoolNode.parse({ copingStyle: 'rock' }).copingStyle).toBe('rock')
  })

  test('ships a valid default PVC pipe network', () => {
    expect(PoolPipeNode.parse({}).type).toBe('pool:pipe-network')
    expect(PoolPipeNode.parse({}).kitId).toBe('pvc')
  })

  test('ships valid defaults for a pool skimmer', () => {
    expect(PoolSkimmerNode.parse({}).type).toBe('pool:skimmer')
    expect(PoolSkimmerNode.parse({}).mouthHeight).toBe(0.14)
  })

  test('ships valid 2-way and 3-way valve defaults', () => {
    expect(PoolValveNode.parse({}).type).toBe('pool:valve')
    expect(PoolValveNode.parse({}).variant).toBe('two-way')
    expect(PoolValveNode.parse({ variant: 'three-way' }).variant).toBe('three-way')
    expect(PoolValveNode.parse({ variant: 'three-way', flowPattern: 'all' }).flowPattern).toBe('all')
    expect(PoolValveNode.parse({ handleAngle: Math.PI / 2 }).handleAngle).toBe(Math.PI / 2)
    expect(PoolValveNode.parse({ diameter: 0.075 }).diameter).toBe(0.075)
  })

  test('ships a valid default circulation pump', () => {
    expect(PoolPumpNode.parse({}).type).toBe('pool:pump')
    expect(PoolPumpNode.parse({}).diameter).toBe(0.05)
  })

  test('ships a valid default pool filter', () => {
    expect(PoolFilterNode.parse({}).type).toBe('pool:filter')
    expect(PoolFilterNode.parse({}).technology).toBe('sand')
  })

  test('ships a valid lower catch basin default', () => {
    expect(PoolCatchBasinNode.parse({}).type).toBe('pool:catch-basin')
    expect(PoolCatchBasinNode.parse(poolCatchBasinDefinition.defaults()).waterDepth).toBe(0.55)
  })

  test('ships a valid watercourse default', () => {
    expect(PoolWatercourseNode.parse({}).type).toBe('pool:watercourse')
    expect(PoolWatercourseNode.parse({}).slope).toBe(-0.12)
  })

  test('ships a complete low-poly rock waterfall and accepts every variant', () => {
    expect(PoolWaterfallNode.parse({}).type).toBe('pool:waterfall')
    const waterfall = PoolWaterfallNode.parse({})
    expect(waterfall.waterfallType).toBe('rock-cascade')
    expect(waterfall.receivingPoolEnabled).toBe(true)
    expect(waterfall.waterColor).toBe('#38bdf8')
    for (const waterfallType of ['modern', 'rock-cascade', 'spillover'] as const) {
      expect(PoolWaterfallNode.parse({ waterfallType }).waterfallType).toBe(waterfallType)
    }
    expect(PoolWaterfallNode.parse({ waterfallType: 'grotto' }).waterfallType).toBe('rock-cascade')
  })

  test('ships a valid shared pool joint default', () => {
    expect(PoolSharedJointNode.parse({ poolIds: ['pool_a', 'pool_b'] }).type).toBe('pool:shared-joint')
  })

  test('ships a valid pool return inlet default', () => {
    expect(PoolInletNode.parse({}).type).toBe('pool:inlet')
    expect(PoolInletNode.parse({}).nozzleDiameter).toBe(0.05)
  })

})
