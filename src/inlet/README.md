# Pool return inlet feature

This vertical slice implements `pool:inlet`, the wall fitting that returns
filtered water to a pool.

## Behavior

The inlet attaches through `poolId`, `wallIndex`, and `wallT`. Placement follows
the current wall and design water elevation; `verticalOffset` places the nozzle
below that waterline. Local `+Z` points into the pool. The model includes a front
flange, nozzle, body, rear connection port, and optional visual flow stream.

The inlet is a visual and spatial model. It does not calculate jet velocity,
circulation coverage, required return count, pipe loss, or pump duty.

## Layout

```text
inlet/
  core/       schema, node definition, geometry, and connection ports
  design/     wall placement and attachment resolution
  editor/     placement tool, preview, parametrics, and rendering adapter
```

Keep wall calculations in `design/placement.ts` and reuse the shared pool-wall
placement behavior where possible. Changes need boundary, rotation, elevation,
missing-pool, and pool-update tests.
