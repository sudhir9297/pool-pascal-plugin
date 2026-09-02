import type { AnyNodeDefinition, Plugin } from '@pascal-app/core'
// Side-effect: subscribes the panel store to `selection:find-node` so the
// host's "find in catalog" lands on the right Pool section (see find-sync.ts).
import './find-sync'
import { poolDefinition } from './definition'
import { hotTubDefinition } from './hotTub-definition'
import { waterFeaturesDefinition } from './waterFeatures-definition'

/**
 * The pools plugin manifest — the entire public surface of this package. A host
 * loads it through the same `loadPlugin` path the built-ins use: three node kinds
 * (`pools:pool`, `pools:hotTub`, `pools:waterFeatures`) and one left-rail panel
 * (`Pools`). Cast mirrors the built-in bundle: `AnyNodeDefinition` is the
 * hand-maintained union today; the registry derives it post-migration.
 */
export const poolsPlugin: Plugin = {
  id: 'pascal:pools',
  apiVersion: 1,
  nodes: [
    poolDefinition as unknown as AnyNodeDefinition,
    hotTubDefinition as unknown as AnyNodeDefinition,
    waterFeaturesDefinition as unknown as AnyNodeDefinition,
  ],
}

export const poolsHostPanel: PoolHostPanel = {
  id: 'pascal:pools:catalog',
  label: 'Pool',
  icon: { kind: 'iconify', name: 'lucide:waves' },
  component: () => import('./presets-panel'),
  pluginId: poolsPlugin.id,
  description: 'Procedural pools, spas, and water features for outdoor scenes.',
  creator: {
    name: 'Pascal',
    url: 'https://github.com/pascalorg',
  },
  pluginUrl: 'https://github.com/pascalorg/plugin-pools',
  defaultInstalled: true,
}

// NOTE: no re-export from './geometry' — it imports the client-only geometry
// `document` at module scope and would crash SSR (this barrel is eagerly
// imported by host bootstraps). Lazy client modules import it directly.
export { poolDefinition } from './definition'
export { hotTubDefinition } from './hotTub-definition'
export { HotTubNode, HotTubPreset } from './hotTub-schema'
export { waterFeaturesDefinition } from './waterFeatures-definition'
export { WaterFeaturesNode, WaterFeaturesPreset } from './waterFeatures-schema'
export { PoolNode, PoolPreset } from './schema'
type PoolHostPanel = {
  id: string
  pluginId: string
  label: string
  description: string
  creator: { name: string; url?: string }
  pluginUrl: string
  icon: { kind: 'iconify'; name: string }
  component: () => Promise<{ default: React.ComponentType }>
  defaultInstalled: boolean
}
