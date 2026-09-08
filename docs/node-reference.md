# Node reference

All dimensions are in metres, rotations are in radians, and colors are CSS color
strings unless a schema says otherwise. Defaults and validation limits live in
each node's `core/schema.ts` file.

## Registered node kinds

| Node kind | Placement | Purpose |
| --- | --- | --- |
| `pool:pool` | Floor plan | Basin, shell, coping, interior, and water |
| `pool:stair` | Pool wall | Stainless-steel access stair |
| `pool:skimmer` | Pool wall at the waterline | Surface-water intake |
| `pool:inlet` | Pool wall below the waterline | Return fitting or jet |
| `pool:valve` | Free-standing | Two-way or three-way PVC valve |
| `pool:pump` | Free-standing | Circulation pump |
| `pool:filter` | Free-standing | Cartridge, sand, or DE filter |
| `pool:heater` | Free-standing | Gas, electric, or heat-pump heater |
| `pool:drain` | Pool floor | Main drain and suction connection |
| `pool:waterfall` | Pool wall or free-standing | Raised waterfall and optional receiving pool |
| `pool:spillover` | Between two pools | Directional water transfer |
| `pool:shared-joint` | Generated between overlapping pools | Shared opening or transition |

## Pool

The default `pool:pool` node is an 8 by 4 metre rectangle with a flat 1.5 metre
depth, continuous coping, a light mosaic finish, and crystal clear water. It has
no entry feature or bench by default.

Supported outline values:

- `rectangle`
- `lap-rectangle`
- `kidney`
- `lagoon`
- `roman`
- `l-shape`
- `spline`
- `custom`

`spline` and `custom` use persisted outline points. Other values regenerate a
known outline from `length` and `width`.

Floor profiles are `flat` and `shallow-to-deep`. Entry features are `none`,
`steps`, `tanning-shelf`, and `beach-entry`. Visual presets are `custom`,
`modern`, `natural`, `resort`, and `lap-pool`.

Water presets are:

- `crystal-clear`
- `vivid-aqua`
- `tropical-lagoon`

Saved values `clear`, `genshin`, and `tropical` are accepted only as migration
aliases. New scenes should use the current values.

Interior finishes are:

- `clean-white-plaster`
- `clean-pale-blue-plaster`
- `white-plaster`
- `quartz-white`
- `quartz-blue-gray`
- `natural-pebble-aqua`
- `natural-pebble-gray`
- `polished-aggregate-blue`
- `glass-bead-aqua`
- `light-mosaic`
- `blue-mosaic`
- `dark-mosaic`

The water shader exposes independent color, surface detail, viscosity, ripple,
clarity, rain, breeze, normal, reflection, refraction, caustic, intersection,
shoreline, specular, and sun controls. A visual preset supplies a coordinated
starting point; direct edits leave the pool in the `custom` preset.

## Pool attachments

Stairs, skimmers, inlets, drains, and mounted waterfalls store a `poolId` plus
wall or floor anchor data. Placement code derives their world transform from
the current pool. Moving, rotating, reshaping, or changing the elevation of the
pool therefore updates the attachment.

If a saved attachment references a missing pool, its schema still parses, but
the host cannot resolve a mounted position until that pool exists again.

### Stair

`pool:stair` mounts to a wall and points local `+Z` into the pool. The default is
the `classic` catalog variant with four steps. The schema permits two through six
steps and configurable width, depth, tube diameter, tread depth, and metal color.

### Skimmer

`pool:skimmer` mounts its mouth at the design waterline and points local `+Z`
into the pool. Styles are `standard`, `wide-mouth`, and `corner`. The access lid
can be `closed` or `open`; basket and flow indicators can be shown independently.

### Return inlet

`pool:inlet` mounts below the design waterline and points local `+Z` into the
pool. It exposes nozzle diameter, flange radius, body depth, vertical offset,
flow length, and flow visibility.

### Drain

`pool:drain` follows the pool floor at its stored floor anchor. Local `+Y` points
toward the pool interior. Grate styles are `round` and `square`; grate size,
suction diameter, body depth, and flow visibility are configurable.

### Waterfall

`pool:waterfall` supports `modern`, `rock-cascade`, and `spillover` forms. Aim at
a pool edge to create a mounted waterfall. Place it on open ground to create a
standalone feature with an optional receiving pool. Mounted waterfalls can size
themselves from the selected pool edge.

The saved legacy value `grotto` migrates to `rock-cascade`. The `waterColor`
field is retained for older scenes; current visuals use the shared water preset
and shallow/deep colors.

## Circulation equipment

Equipment ports are spatial connection metadata for the Pascal host. They do
not create pipes or calculate hydraulic performance.

### Pump

`pool:pump` is a free-standing circulation pump. Local `+Z` is its inlet and
local `+Y` is its outlet. Body dimensions, connection diameter, and flow
visibility are configurable.

### Filter

`pool:filter` supports `cartridge`, `sand`, and `diatomaceous-earth` technology.
The built-in catalog contains one representative model for each technology.
The default is `sand-standard-600` with a top-mounted valve and visible gauge.

Catalog flow rates and filtration areas are descriptive data. The plugin does
not select a filter from pool volume or operating conditions.

### Heater

`pool:heater` supports `gas`, `electric`, and `heat-pump` technology. The default
is the `heat-pump-twin-fan` model. Water ports are always modeled; exhaust and
flow visuals are optional.

### Valve

`pool:valve` supports `two-way` and `three-way` bodies. A two-way valve uses
`open` or `closed`. A three-way valve supports `left-right`, `left-branch`,
`right-branch`, `all`, `open`, and `closed`. The selected pattern changes the
visible internal path, not whether a pipe may attach to a socket.

## Connections between pools

### Shared joint

`pool:shared-joint` represents overlapping pools with a shared opening. Modes
are `open`, `submerged-shelf`, and `spillover`. Its intersection data is used to
remove duplicated shell, floor, and water regions and to build the transition.
Shared joints are synchronized from the two referenced pools.

### Spillover

`pool:spillover` connects two pools that share a parent level. The pool with the
higher world water elevation becomes the source. Connection styles are `auto`,
`direct-spillover`, and `watercourse`; resolved geometry uses `overlap`, `direct`,
or `channel` mode.

The resolver supports adjacent, overlapping, curved, rotated, and translated
outlines. It rejects fully coincident pools and connections beyond its modeled
range. Same-level intersecting pools set `mergedSurface` and share the pool-owned
surface instead of drawing a falling connector mesh. The persisted minimum
`dropHeight` remains 0.02 metres for schema compatibility.

Spillovers create shallow source and target openings. They do not replace the
full-depth pool overlap in the way a shared joint does.

## Modeling limits

These nodes communicate intended layout and appearance. They are not a pool
engineering calculator, equipment selector, plumbing router, code-compliance
checker, or construction document generator.
