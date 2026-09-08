# Public API

The package exposes one ESM entry point:

```ts
import { poolPlugin } from '@pascal-app/plugin-pool'
```

Use only exports from `@pascal-app/plugin-pool`. Paths under `src/` and `dist/`
are not stable subpath APIs.

## Host registration

`poolPlugin` is the primary integration surface. `poolHostPanel` contains the
catalog panel metadata used by Pascal's editor host.

```ts
import { setPluginDiscovery } from '@pascal-app/core'
import { poolPlugin } from '@pascal-app/plugin-pool'

setPluginDiscovery(async () => [poolPlugin])
```

The manifest has ID `pascal:pool`, Plugin API version 1, and 12 node definitions.

## Schemas and definitions

Each node kind exports a Zod schema and a host definition:

| Feature | Schema | Definition |
| --- | --- | --- |
| Pool | `PoolNode` | `poolDefinition` |
| Stair | `PoolStairNode` | `poolStairDefinition` |
| Skimmer | `PoolSkimmerNode` | `poolSkimmerDefinition` |
| Return inlet | `PoolInletNode` | `poolInletDefinition` |
| Valve | `PoolValveNode` | `poolValveDefinition` |
| Pump | `PoolPumpNode` | `poolPumpDefinition` |
| Filter | `PoolFilterNode` | `poolFilterDefinition` |
| Heater | `PoolHeaterNode` | `poolHeaterDefinition` |
| Drain | `PoolDrainNode` | `poolDrainDefinition` |
| Waterfall | `PoolWaterfallNode` | `poolWaterfallDefinition` |
| Spillover | `PoolSpilloverNode` | `poolSpilloverDefinition` |
| Shared joint | `PoolSharedJointNode` | `poolSharedJointDefinition` |

The schema value and inferred TypeScript type share the same exported name.
Parse untrusted saved data before using it:

```ts
import { PoolNode } from '@pascal-app/plugin-pool'

const result = PoolNode.safeParse(savedNode)
if (!result.success) throw result.error

const pool = result.data
```

Defaults belong to schemas. Do not reproduce them in a host application.

## Parametric descriptors

The package exports parametric descriptors for pools, stairs, skimmers, inlets,
drains, valves, filters, heaters, spillovers, shared joints, and waterfalls.
Their names follow the `pool<Name>Parametrics` pattern, with `poolParametrics`
for the main pool.

These descriptors are useful when a host builds its own property interface.
The standard node definitions already connect them to Pascal.

## Pool outlines and freehand input

Use `POOL_SHAPES`, `POOL_SHAPE_OPTIONS`, `createPoolShapePolygon`,
`isDrawnPoolShape`, and `sampleClosedPoolSpline` for supported outline behavior.
`advanceFreehandPoolStroke` and `buildFreehandPoolOutline` convert pointer input
into a stable custom outline.

```ts
import {
  PoolNode,
  createPoolShapePolygon,
  type PoolShape,
} from '@pascal-app/plugin-pool'

const shape: PoolShape = 'kidney'
const pool = PoolNode.parse({
  shape,
  polygon: createPoolShapePolygon(shape, 8, 4),
})
```

## Presets and catalogs

- `WATER_PRESETS`, `WATER_PRESET_SETTINGS`, and `getWaterPresetSettings`
- `POOL_FINISHES`, `POOL_FINISH_SETTINGS`, and `getPoolFinishSettings`
- `POOL_VISUAL_PRESETS`, `POOL_VISUAL_PRESETS_SETTINGS`, and
  `getPoolVisualPreset`
- `POOL_STAIR_VARIANTS`, `POOL_STAIR_CATALOG`, and `getPoolStairPreset`
- `POOL_FILTER_CATALOG` and `getPoolFilterData`

Use the lookup functions when input can come from an older or untrusted scene.
They apply the package's fallback and migration behavior.

## Placement and synchronization

The root entry point exports supported helpers for:

- Resolving and synchronizing pool spillovers
- Finding and resolving mounted inlets, stairs, and waterfalls
- Creating standalone waterfall placement
- Resolving stair mounting details
- Locating a drain on a pool floor

These functions are deterministic and do not read the editor store. Pass parsed
node data and apply returned patches through the host's scene API.

## Geometry and ports

`buildDrainGeometry`, `getDrainPortDirection`, and `getDrainPortPosition` expose
the drain's public geometry contract. Filter port helpers and filter port types
are also exported. Other procedural geometry remains an internal renderer detail.

Callers that allocate Three.js objects are responsible for disposing geometry,
materials, and textures they no longer use.

## Stores

`usePoolStore` and `usePoolStairStore` are editor stores. Prefer schema and pure
helper exports outside an editor integration so business logic remains independent
of React and host state.

## Compatibility

This package is below version 1.0. Patch versions should remain compatible;
minor versions may change public exports or saved data with a documented
migration. The node schemas currently migrate these legacy values:

- Pool or waterfall water preset `clear` to `crystal-clear`
- Pool or waterfall water preset `genshin` to `vivid-aqua`
- Pool or waterfall water preset `tropical` to `tropical-lagoon`
- Waterfall type `grotto` to `rock-cascade`

The deprecated waterfall `waterColor` field is accepted for old scenes. New
code should use the shared water preset plus shallow and deep water colors.
