# Architecture

## Package boundary

`src/index.ts` is the only published JavaScript entry point. It must remain safe
to import in a server-rendered process. Node definitions expose small metadata
objects and lazy-load browser-only tools, previews, and renderers.

The build emits ESM, declarations, source maps, and copied assets under `dist/`.
Consumers provide the dependencies listed in `peerDependencies`; geometry
libraries needed only by this implementation remain runtime dependencies.

## Source layout

```text
src/
  core/                       pool schema, defaults, definition, and geometry
  design/                     deterministic pool calculations
  editor/                     Pascal host adapters, tools, previews, and renderer
  shader/                     water materials and texture assets
  drain|filter|heater|.../    one vertical slice per contributed node kind
  shared-joint/               generated connection between overlapping pools
  spillover/                  directional connection between two pools
  water-feature/waterfall/    waterfall vertical slice
```

A feature slice normally contains:

```text
feature/
  core/       persisted schema, defaults, definition, ports, and geometry
  data/       optional catalogs and data-only types
  design/     placement and synchronization calculations
  editor/     tools, previews, controls, stores, and parametrics
```

Not every feature needs every directory.

## Dependency direction

Schemas and data are the lowest layer. Deterministic design code may depend on
them. Editor code may depend on schemas, data, design helpers, and geometry.
Definitions connect the layers to the host and use lazy imports for client code.

Two rules are enforced automatically:

1. Editor modules may not import a feature's `core/definition.ts`.
2. Runtime imports may not form a cycle.

Run `bun run check-architecture` after moving a module or changing imports.
Use `import type` when a dependency exists only for TypeScript.

## Persisted nodes

Zod schemas define saved data, defaults, bounds, and legacy preprocessing. A new
field needs a schema default so old scenes continue to parse. A renamed enum
value needs preprocessing and a migration test. Removing a field or changing
its meaning requires an explicit compatibility decision and changelog entry.

The host definition owns registration metadata, floor-plan geometry, handles,
ports, and lazy editor modules. The schema, not the definition or the editor,
owns default values.

## Geometry lifecycle

Pure calculations return numbers, vectors, polygons, or patches and should not
read global editor state. Procedural geometry builders may allocate Three.js
objects. Renderers cache or replace those objects and must dispose replaced
geometry, materials, and textures.

Pool rendering combines several inputs:

1. Resolve the persisted outline and depth profile.
2. Resolve attachments and connections against current pool transforms.
3. Calculate shell, floor, coping, water, entry, bench, and opening geometry.
4. Apply shared-joint overlap removals and shallow spillover notches.
5. Render the water material and feature-specific visuals.

Shared joints and spillovers are deliberately separate. A shared joint removes
duplicated full-depth regions. A spillover preserves the separating basin
structure and cuts only its modeled openings.

## Attachment lifecycle

Mounted nodes store a `poolId` and local wall or floor anchor. Placement helpers
derive their world transform from the current pool. Synchronization runs when a
pool or related node changes, allowing attachments to follow translation,
rotation, elevation, and outline edits.

Keep placement logic in `design/` when it can be expressed without React or the
host store. The editor layer should translate host events into calls to those
helpers and apply the resulting node patch.

## Public API decisions

Export from `src/index.ts` when at least one external consumer needs a stable
contract. Prefer schemas, data, and deterministic helpers. Avoid exporting a
renderer component, editor adapter, or incidental geometry helper unless a host
cannot integrate without it.

Any public export change requires:

- A declaration-level consumer test in `tests/package-consumer.ts`
- Documentation in [Public API](public-api.md)
- A changelog entry when consumers can observe the change

## Verification boundaries

Unit tests cover schemas, migrations, geometry helpers, placements, connections,
and stores that do not require a live host. Package tests import the built output
and type-check a consumer. Architecture and reproducibility scripts cover module
boundaries and output stability.

Browser interactions, renderer screenshots, and WebGL or WebGPU behavior need a
Pascal host fixture. The remaining host scenarios are listed in
[Testing and release](testing-and-release.md).
