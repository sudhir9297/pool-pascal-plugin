# Pool drain feature

This vertical slice implements the `pool:drain` node.

## Behavior

The drain attaches to a pool floor using `poolId` and a two-dimensional
`floorAnchor`. Placement resolves the current floor elevation, including a
shallow-to-deep profile, and local `+Y` points into the pool. Grates can be
`round` or `square`. The body exposes one suction port and an optional visual
flow indicator.

The drain is a visual model. It does not calculate flow capacity, pipe size,
entrapment risk, cover compliance, or the number of drains required.

## Layout

```text
drain/
  core/       schema, definition, geometry, and connection ports
  design/     pool-floor placement
  editor/     tool, preview, parametrics, and rendering adapter
```

Keep defaults and bounds in `core/schema.ts`. Keep floor calculations in
`design/pool-placement.ts` so they can be tested without the editor. Changes to
the attachment contract need flat, sloped, rotated, translated, and missing-pool
test cases.
