import { describe, expect, test } from 'bun:test'
import { poolsHostPanel, poolsPlugin } from './index'
import { HotTubNode } from './hotTub-schema'
import { WaterFeaturesNode } from './waterFeatures-schema'
import { PoolNode } from './schema'

describe('Pool plugin manifest', () => {
  test('exports the stable plugin identity and node kinds', () => {
    expect(poolsPlugin.id).toBe('pascal:pools')
    expect(poolsPlugin.apiVersion).toBe(1)
    expect(poolsPlugin.nodes?.map((definition) => definition.kind)).toEqual([
      'pools:pool',
      'pools:hotTub',
      'pools:waterFeatures',
    ])
  })

  test('associates the Pool panel with the plugin', () => {
    expect(poolsHostPanel.pluginId).toBe(poolsPlugin.id)
    expect(poolsHostPanel.defaultInstalled).toBe(true)
    expect(poolsHostPanel.pluginUrl).toBe('https://github.com/pascalorg/plugin-pools')
  })

  test('ships valid defaults for every contributed node schema', () => {
    expect(PoolNode.parse({}).type).toBe('pools:pool')
    expect(HotTubNode.parse({}).type).toBe('pools:hotTub')
    expect(WaterFeaturesNode.parse({}).type).toBe('pools:waterFeatures')
  })
})
