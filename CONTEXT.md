# Pool plugin domain vocabulary

Use these terms in schemas, editor labels, tests, and documentation.

## Basin

The excavated or modeled volume that holds water. A `pool:pool` node owns the
basin shell, floor, coping, and water surface.

## Coping

The finished cap around the top edge of a pool shell. The plugin supports a
continuous profile, natural-stone units, and generated rock coping.

## Design water elevation

The water surface height relative to a pool node's local elevation. World water
height is the pool's world Y position plus `designWaterElevation`.

## Entry feature

A basin feature used to enter or rest in the pool. Supported values are steps,
a tanning shelf, and a beach entry. A pool may also have no entry feature.

## Floor profile

The rule used to calculate basin depth. A flat profile has one depth. A
shallow-to-deep profile uses shallow and deep depths with a sloped transition.

## Natural water feature

A naturalistic secondary water system associated with a swimming pool. It can
include a waterfall or spillway, a watercourse, and surrounding rockwork.

## Pool attachment

A node anchored to a pool wall or floor by a pool ID and local placement data.
Stairs, skimmers, return inlets, drains, and mounted waterfalls are attachments.
Their world position is derived again when the owning pool moves or changes.

## Return inlet

A wall fitting that sends filtered water back into a pool. It is also called a
return jet. The plugin node ID is `pool:inlet`.

## Rockwork

The boulders, retaining stones, ledges, and rock surround that shape and conceal
a natural water feature.

## Shared joint

A generated connection between overlapping pools that removes duplicated shell,
floor, and water regions. It can represent an open join, a submerged shelf, or
a spillover-style transition. It is distinct from a directional spillover.

## Skimmer

A wall-mounted surface-water intake with a mouth, weir, basket, access lid, and
suction connection. Its visual model does not calculate hydraulic capacity.

## Spillover

A directional water transfer from a source pool to a target pool. The source is
the pool with the higher world water elevation. Same-level intersecting pools
can merge their surface instead of rendering a falling sheet.

## Spillway

The controlled overflow edge or lip where water leaves an upper basin. A
waterfall describes the visible falling-water effect; a spillway describes the
edge that creates it.

## Watercourse

The visible channel or stream bed carrying water between two basins.

## Waterline

The intersection between the design water elevation and the pool shell. Wall
attachments use this reference for their vertical placement.
