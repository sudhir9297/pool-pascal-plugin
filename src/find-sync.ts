import { type AnyNode, emitter } from '@pascal-app/core'
import type { HotTubNode } from './hotTub-schema'
import type { WaterFeaturesNode } from './waterFeatures-schema'
import type { PoolNode } from './schema'
import { type PoolsPanelMode, usePoolsStore } from './store'

/**
 * "Find in catalog" sync. The editor's node action menu emits
 * `selection:find-node`; the host opens the panel that owns the kind — but
 * which *section* of the Pool panel to
 * show is plugin knowledge, so the plugin listens too and points its own store
 * at the found node's section + preset. Module-level (imported by the plugin
 * manifest) so the listener is live from plugin load, even while the panel has
 * never been mounted.
 */

const MODE_BY_KIND: Record<string, PoolsPanelMode> = {
  'pools:pool': 'pools',
  'pools:hotTub': 'hotTubs',
  'pools:waterFeatures': 'waterFeatures',
}

const findNodeEmitter = emitter as unknown as {
  on: (type: 'selection:find-node', handler: (node: AnyNode) => void) => void
}

findNodeEmitter.on('selection:find-node', (node) => {
  const mode = MODE_BY_KIND[node.type as string]
  if (!mode) return
  const store = usePoolsStore.getState()
  store.setMode(mode)
  if (mode === 'pools') {
    const pool = node as unknown as PoolNode
    store.setPreset(pool.preset ?? 'family')
    store.setSize(pool.size ?? 'medium')
  } else if (mode === 'hotTubs') {
    store.setHotTubPreset((node as unknown as HotTubNode).preset ?? 'spa')
  } else {
    store.setWaterFeaturesPreset((node as unknown as WaterFeaturesNode).preset ?? 'fountain')
  }
})
