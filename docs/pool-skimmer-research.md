# Pool skimmer model

Research checked 2026-09-07. Implementation status was reconciled with the code
on 2026-09-08.

## Real-world behavior

A residential pool skimmer is a recessed, wall-mounted surface-water intake.
The pump draws water over a floating weir into a removable basket. A deck lid
provides access for cleaning, and a suction line continues toward circulation
equipment.

The mouth is installed near the finished waterline. Wind, return placement,
plumbing layout, product selection, and local requirements affect a real
installation and remain outside this visual model.

## Plugin assumptions

- Local `+Z` points from the wall into the pool; the housing and suction port
  extend toward local `-Z`.
- The origin is the center of the mouth at the design waterline.
- `poolId`, `wallIndex`, and `wallT` anchor the skimmer to a pool wall.
- `waterlineOffset` moves the mouth relative to the pool's design water elevation.
- Styles are `standard`, `wide-mouth`, and `corner`.
- The lid can be `closed` or `open`; basket and flow visuals are optional.
- Default dimensions represent a generic residential unit and are not an
  installation template for a named product.

The procedural model includes the mouth, weir, housing, basket, access lid, and
suction connection. Placement synchronization makes it follow pool movement,
rotation, elevation, and outline edits. The model does not calculate intake
velocity, required skimmer count, pipe sizing, or entrapment safety.

## Sources

- [Pentair U-3 skimmer installation guide](https://www.pentair.com/content/dam/extranet/nam/pentair-pool/pool-manuals/u-3-skimmers/395010028C.pdf)
- [Fluidra skimmer installation manual](https://fluidra.bynder.com/m/54fcd96858803460/original/installationmanual_32373_30867_ALL_2021_12.pdf)
- [AquaStar FlowStar skimmer product details](https://www.aquastarpoolproducts.com/products/skr2xxf)
- [Poolrite innoSkim components](https://www.poolrite.com/products/innoskim-skimmer-boxes-spare-parts)
