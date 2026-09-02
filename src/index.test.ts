import { describe, expect, test } from 'bun:test'
import { poolHostPanel, poolPlugin, PoolNode, PoolPipeNode, PoolSkimmerNode, PoolValveNode, PoolPumpNode } from './index'

describe('Swimming pool plugin manifest', () => {
  test('exports the stable plugin identity and node kinds', () => {
    expect(poolPlugin.id).toBe('pascal:pool')
    expect(poolPlugin.apiVersion).toBe(1)
    expect(poolPlugin.nodes?.map((definition) => definition.kind)).toEqual(['pool:pool', 'pool:pipe-network', 'pool:skimmer', 'pool:valve', 'pool:pump'])
  })

  test('associates the Pool panel with the plugin', () => {
    expect(poolHostPanel.pluginId).toBe(poolPlugin.id)
    expect(poolHostPanel.defaultInstalled).toBe(true)
    expect(poolHostPanel.pluginUrl).toBe('https://github.com/pascalorg/plugin-pool')
  })

  test('ships valid defaults for every contributed node schema', () => {
    expect(PoolNode.parse({}).type).toBe('pool:pool')
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
  })

  test('ships a valid default circulation pump', () => {
    expect(PoolPumpNode.parse({}).type).toBe('pool:pump')
    expect(PoolPumpNode.parse({}).diameter).toBe(0.05)
  })


})
