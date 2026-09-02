# Pascal Pool plugin

The Pascal Pool plugin adds configurable swimming pools with procedural basin
geometry and animated water. It is a strictly TypeScript package for Pascal
Plugin API v1.

## Included feature

The manifest registers one node kind: `pool:pool`.

It supports:

- preset, custom, and freeform pool outlines;
- rectangular, lap, L, kidney, round, oval, and polygonal pools;
- shallow-to-deep floor profiles, steps, benches, shelves, and beach entries;
- coping and shell geometry;
- animated water with Clear, Genshin, and Tropical presets;
- editable water color, normals, ripples, reflections, refraction, caustics,
  shoreline, rain, breeze, and sun settings.

No hot tubs, fountains, waterfalls, equipment, fittings, pipes, rocks, or other
scene items are registered by this package.

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
  swimming-pool/
    core/      schema, node definition, and geometry
    design/    outlines, depth, coping, entries, and opening sync
    editor/    panel, tool, preview, renderer, and parametrics
    shader/    water effect, presets, actions, and texture assets
```

See [Create a plugin](https://editor.pascal.app/docs/developers/plugins) for
the official Pascal Plugin API v1 contract.

## License

MIT.
