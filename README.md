# Pascal Pool plugin

The Pascal Pool plugin adds procedural swimming-pool content to Pascal scenes.
It is a standalone TypeScript package designed to be reviewed and bundled by a
Pascal host.

## Included node kinds

- `pools:pool` — configurable lap, family, infinity, plunge, courtyard, and spa designs.
- `pools:hotTub` — spa, therapy-pool, and plunge-spa variants.
- `pools:waterFeatures` — fountain, spillway, and cascade variants.

Each node has a Zod schema, Pascal defaults, placement tool, preview, renderer,
floor-plan symbol, inspector metadata, and MCP description. Shared geometry is
cached and instanced so repeated features stay efficient.

## Development

```bash
bun install
bun run check-types
bun test
bun run build
```

The package targets Pascal Plugin API v1. Pascal packages, React, React DOM,
Three.js, React Three Fiber, Zod, and Zustand are peer dependencies so the host
and plugin share one runtime and node registry.

## Host integration

```ts
import { setPluginDiscovery } from '@pascal-app/core'
import { poolsPlugin } from '@pascal-app/plugin-pools'

setPluginDiscovery(async () => [poolsPlugin])
```

The editor panel is exported separately as `poolsHostPanel`. A host should
register it with its reviewed editor-panel integration. Plugin API v1 does not
download packages, add server routes, or connect to external services; this
plugin uses no accounts, OAuth scopes, personal data, or network calls.

## Layout

`src/index.ts` is the public manifest and export surface. Node schemas and
definitions are kept separate from lazy client-only tools and renderers so
loading plugin metadata does not initialize Three.js geometry. `src/instanced.tsx`
contains the shared batching path, while placement, elevation, and floor-plan
helpers remain reusable for future pool components.

See [Create a plugin](https://editor.pascal.app/docs/developers/plugins) for the
official Pascal Plugin API v1 contract.

## License

MIT.
