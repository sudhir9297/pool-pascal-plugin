# pool-pascal-plugin

The Pascal Pool plugin adds configurable swimming pools with procedural basin
geometry and animated water. It is a strictly TypeScript package for Pascal
Plugin API v1.

## Included feature

The manifest registers pool, skimmer, suction-valve, and
circulation-pump node kinds.

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
- a registered pool drain node ready for geometry and editor integration;
- a low-poly rock waterfall with an animated curtain, pool impact mist, and modern, rock-cascade, and spillover variants.

The rock cascade is available from the Pools side menu for interactive testing.

## Development

```bash
bun install
bun run check-types
bun test
bun run build
```

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
  core/      schema, node definition, and geometry
  pump/      circulation pump schema, geometry, and editor integration
  drain/     floor-mounted pool drain schema and node definition
  skimmer/   wall-mounted skimmer schema, geometry, and placement
  valve/     suction valve schema, geometry, and placement
  water-feature/waterfall/  rock formation, plunge pool, animated water, and editor controls
  design/    outlines, depth, coping, entries, and opening sync
  editor/    panel, tool, preview, renderer, and parametrics
  shader/    water effect, presets, actions, and texture assets
```

See [Create a plugin](https://editor.pascal.app/docs/developers/plugins) for
the official Pascal Plugin API v1 contract.

## License

MIT.
