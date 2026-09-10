# Pascal Pool plugin

`@pascal-app/plugin-pool` adds procedural swimming pools, circulation equipment,
pool-to-pool connections, stairs, and animated water features to Pascal.

The package is ESM-only. It includes TypeScript declarations, source maps, and
the runtime assets used by the editor and water renderer.

## Requirements

- Bun 1.3.12 for repository development
- A Pascal host using Plugin API v1
- React 18 or 19
- Three.js 0.185

The exact Pascal, React, React Three Fiber, Zod, Zustand, and Three.js ranges are
declared as peer dependencies in `package.json`.

## Installation

```bash
bun add @pascal-app/plugin-pool
```

The host application must also provide the package's peer dependencies.

## Host integration

Register the manifest with the host's plugin discovery function:

```ts
import { setPluginDiscovery } from '@pascal-app/core'
import { poolPlugin } from '@pascal-app/plugin-pool'

setPluginDiscovery(async () => [poolPlugin])
```

`poolPlugin` has the ID `pascal:pool`, uses Plugin API v1, and registers 12 node
kinds. The public manifest is safe to load during server rendering. Geometry,
editor tools, previews, and renderers are loaded lazily in the browser.

## Features

- Rectangle, lap rectangle, kidney, lagoon, Roman, L-shape, spline, and custom
  pool outlines
- Flat and shallow-to-deep floors with steps, tanning shelves, beach entries,
  benches, coping, and shell geometry
- Crystal clear, vivid aqua, and tropical lagoon water presets with editable
  surface, reflection, refraction, caustic, shoreline, weather, and sun settings
- Plaster, quartz, pebble, polished aggregate, glass bead, and mosaic finishes
- Wall-mounted stairs, skimmers, and return inlets, plus floor-mounted drains
- Pumps, filters, heaters, and two-way or three-way valves with connection ports
- Shared joints and directional spillovers between pools
- Modern, rock-cascade, and spillover waterfalls that can mount to a pool or use
  a standalone receiving pool

See the [node reference](docs/node-reference.md) for node IDs, placement rules,
defaults, options, and model limits.

## Package API

Most hosts only need `poolPlugin`. The package also exports its node schemas,
node definitions, parametric descriptors, catalogs, preset data, stores, and
pure geometry or placement helpers for integrations that need them.

See the [public API guide](docs/public-api.md) before importing anything beyond
the manifest. Files below `src/` are implementation details and are not package
entry points.

## Development

```bash
bun install --frozen-lockfile
bun run verify
```

`verify` checks documentation, dependency direction, runtime import cycles,
TypeScript, unit tests, production output, package contents, declarations, and
consumer imports. Before tagging a release, run:

```bash
bun run release:check
```

The release gate adds coverage floors, reproducible-build verification, release
metadata checks, and a high-severity dependency audit.

Read [Contributing](CONTRIBUTING.md) before changing code. The
[architecture guide](docs/architecture.md) explains module boundaries, and
[testing and release](docs/testing-and-release.md) describes every automated
gate and the publishing process.

## Limitations

- Equipment and water flow are visual and parametric. The plugin does not size
  plumbing or simulate pressure, head loss, turnover, filtration, heating, or
  water chemistry.
- Dimensions are modeling inputs, not construction approval. Verify structural,
  electrical, plumbing, accessibility, and safety requirements separately.
- Browser-level editor workflows still require a reusable Pascal host fixture.
  Current automated tests cover schemas, pure calculations, geometry contracts,
  packaging, and release metadata.

## Documentation

The [documentation index](docs/README.md) links the user, integration,
architecture, testing, release, and research notes. Domain terms are defined in
[CONTEXT.md](CONTEXT.md). Security reports follow [SECURITY.md](SECURITY.md).

For Pascal's host contract, see
[Create a plugin](https://editor.pascal.app/docs/developers/plugins).

## License

[MIT](LICENSE)

### Automatic pool fittings

New pools calculate skimmers, return inlets and floor drains from their water area, perimeter and circulation estimate, with one access stair. Changing the dimensions recalculates both counts and placement. Pool options show the counts and let you change turnover time, specify flow, or set the selected drain's flow capacity. Disable **Automatic fittings** to edit the generated layout manually. Existing saved pools remain manual until enabled.

The defaults are planning estimates based on manufacturer guidance and published design benchmarks. See [fitting layout rules and sources](docs/pool-fitting-layout.md) for the calculations, spacing, assumptions and limitations.
