# Pascal Pool Plugin

Procedural swimming pools, fittings, equipment and animated water for the
Pascal editor (`@pascal-app/plugin-pool`).

```bash
bun install
bun run check-types
bun test
bun run check:render
```

## Read-only viewers

A viewer that only displays saved scenes can load the render-only entry instead
of the root plugin. It registers the same 12 `pool:*` kinds, schemas, versions
and defaults, with their geometry, renderers, materials, animated water, opening
system, ports, plans and export animation, and does not import
`@pascal-app/editor`:

```ts
import { poolRenderPlugin } from '@pascal-app/plugin-pool/render'

await loadPlugin(poolRenderPlugin)
```

Paint, placement tools and previews, handles, plan move and outline editing,
parameters, keyboard actions and the Pools panel are only in the root export.
Load one entry or the other, not both. `bun run check:render` bundles `./render`
and fails if it reaches `@pascal-app/editor` or `next`.
