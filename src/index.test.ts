import { describe, expect, test } from 'bun:test'
import { poolHostPanel, poolPlugin, PoolNode } from './index'

describe('Swimming pool plugin manifest', () => {
  test('exports the stable plugin identity and node kinds', () => {
    expect(poolPlugin.id).toBe('pascal:pool')
    expect(poolPlugin.apiVersion).toBe(1)
    expect(poolPlugin.nodes?.map((definition) => definition.kind)).toEqual(['pool:pool'])
  })

  test('associates the Pool panel with the plugin', () => {
    expect(poolHostPanel.pluginId).toBe(poolPlugin.id)
    expect(poolHostPanel.defaultInstalled).toBe(true)
    expect(poolHostPanel.pluginUrl).toBe('https://github.com/pascalorg/plugin-pool')
  })

  test('ships valid defaults for every contributed node schema', () => {
    expect(PoolNode.parse({}).type).toBe('pool:pool')
  })
})
