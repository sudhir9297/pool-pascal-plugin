# pool-pascal-plugin

The Pascal Pool plugin adds configurable swimming pools with procedural basin
geometry and animated water. The source is TypeScript and the published package
contains browser-ready ESM, declarations, source maps, and runtime assets.

## Included feature

The manifest registers pool, stair, skimmer, return-inlet, drain, valve, pump,
filter, heater, shared-joint, spillover, and waterfall node kinds.

It supports:

- preset, custom, and freeform pool outlines;
- rectangular, lap, L, kidney, round, oval, and polygonal pools;
- shallow-to-deep floor profiles, steps, benches, shelves, and beach entries;
- coping and shell geometry;
- an optional deterministic rock border made from individually shaped stones;
- animated water with Clear, Genshin, and Tropical presets;
- editable water color, normals, ripples, reflections, refraction, caustics,
  shoreline, rain, breeze, and sun settings.
- placeable pool equipment with procedural pump, filter, drain, and valve models.
- a floor-mounted pool drain with geometry and editor integration;
- a placeable low-poly waterfall with animated flow, pool-edge mounting, a standalone receiving pool, and distinct modern, rock-cascade, and spillover variants.

Waterfalls are available from the Pools side menu. Aim near a pool edge to mount one, or click open ground to place a standalone waterfall with a receiving pool.

## Development

```bash
bun install
bun run check-architecture
bun run check-types
bun test
bun run build
bun run verify
```

`bun run release:check` adds coverage floors, package-content checks, release
metadata validation, and a high-severity dependency audit. The full process is
documented in [Testing and release](docs/testing-and-release.md).

## Host integration

```ts
import { setPluginDiscovery } from '@pascal-app/core'
import { poolPlugin } from '@pascal-app/plugin-pool'

setPluginDiscovery(async () => [poolPlugin])
```

The public manifest stays lightweight. Client-only Three.js geometry, editor
tools, and the water renderer are loaded through the pool definition's lazy
modules, so host metadata loading remains safe for SSR.

## Layout

```text
src/
  core/                       pool model, defaults, definition, and geometry
  design/                     pure pool geometry and placement calculations
  editor/                     host adapters, placement tools, and renderers
  shader/                     animated-water implementations and texture assets
  drain|filter|heater|.../    one vertical slice per contributed node kind
  water-feature/waterfall/    waterfall model, geometry, placement, and editor adapter
```

Schemas own node defaults. Definitions describe host registration and lazy-load
editor modules. Editor modules may depend on schemas and design calculations,
but they may not import definitions. `bun run check-architecture` rejects that
dependency direction and any runtime import cycle.

See [Create a plugin](https://editor.pascal.app/docs/developers/plugins) for
the official Pascal Plugin API v1 contract.

## License

MIT.
