# Pool filter feature

This vertical slice implements the `pool:filter` node, its representative model
catalog, procedural geometry, editor integration, and connection ports.

## Behavior

Supported technologies are `cartridge`, `sand`, and `diatomaceous-earth`. The
default catalog entry is `sand-standard-600`. Choosing a catalog entry supplies
the technology, tank dimensions, connection diameter, descriptive flow range,
and filtration area. The node can then retain editable geometry values.

Catalog ratings are reference metadata. The feature does not size a filter from
pool volume, turnover target, plumbing loss, or local requirements.

## Data layout

Keep each catalog entry data-only and use SI units:

- Dimensions and connection diameters in metres
- Flow ranges in cubic metres per hour
- Filtration area in square metres

Geometry-driving values belong in `tank` and `connectionDiameter`, so changing a
catalog model updates the visible tank and connection ports together. Optional
manufacturer or maintenance details belong in `metadata` and must not control
geometry.

## Layout

```text
filter/
  core/       schema, definition, geometry, and connection ports
  data/       catalog entries and data-only types
  editor/     placement, preview, parametrics, and rendering adapter
```

Add catalog tests when changing identifiers or values. Add geometry and port
tests when a catalog field begins to affect the rendered model.
