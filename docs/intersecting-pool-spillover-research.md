# Intersecting pools and spillovers

Research checked 2026-09-07. This note separates built examples from the proposed rendering behavior.

## What builders describe

- An attached raised spa keeps a separating dam wall. Its spillover is a weir in the top of that wall, with a lip that sends a sheet of water back into the pool. The wall below the opening remains part of the shell. [Splash Pools, attached spas and dam walls](https://www.splashpoolsllc.com/spa-remodeling-naples/)
- Integrated pool and spa combinations can place the spa inside the pool's plan. River Pools describes fiberglass combinations molded with both basins together. Its spillover explanation describes pumping pool water into the spa so it overflows back into the pool. [River Pools, pool and spa designs](https://www.riverpoolsandspas.com/blog/pool-and-spa-designs-decide-what-is-best-for-your-yard)
- Aqualis describes a raised spillover spa built into the pool structure and overflowing its wall into the lower pool. This is a useful visual reference for two connected water levels. [Aqualis Pools, spillover spas](https://aqualispoolsllc.com/spillover-spa/)
- Flush designs are a separate case. California Pools describes a continuous waterline and also shows level spillway designs with gentle controlled flow. A flush design does not imply a tall falling sheet. [California Pools, level spas](https://www.calpool.com/level-spa/)

These examples support a separating wall and a localized overflow lip. They do not prescribe how a modeling application should assign the area of two arbitrarily overlapping outlines. Preserving either outline or designing a new dividing line is a design choice.

## Recommended model policy for different water levels

The following is a rendering recommendation inferred from those examples, not a construction rule.

1. Preserve the higher basin's outline, water and floor. Its pool-facing wall becomes the separator where it projects into the lower basin.
2. Exclude the higher basin's occupied footprint from the lower basin's visible water, floor and intersecting shell/coping. Include the wall thickness so lower water cannot show through the divider. Keep the resulting join closed.
3. Keep the separating wall below the source waterline. Cut only the spillover-width opening at the top, including the coping, with a finished sill and end faces.
4. Put the outlet on the portion of the source boundary that faces actual remaining lower-pool water. Shorten the connection to the shared wall when no external gap remains. Keep the falling sheet and landing clear of rock coping.
5. Apply the same clipped boundaries to the pool mesh, water mesh, coping, spillover preview and final placement. Curved, rotated, concave and nested outlines need the same rules.

A different chosen dividing line would require trimming both basins and building a new separator. It should be an explicit modeling policy rather than an accidental result of clipping.

For equal actual water elevations, render a level connection or another chosen flush detail. Do not invent a vertical drop merely to keep a waterfall mesh nonzero. A shallow pumped spillway remains possible, but would need an explicit visual design.

## Current code observations

Observed before implementation changes on 2026-09-07:

- `getPoolConnectionRegions` in `src/design/shared-joint.ts` filters exclusively for `pool:shared-joint`. Spillovers therefore do not contribute the regions used to remove overlapping pool shell, floor and water.
- The pool renderer uses those connection regions for all three removal options in `src/editor/renderer.tsx`.
- `src/spillover/design/placement.ts` clamps the source-to-target water-height difference to at least `0.02`. The spillover schema also sets that minimum. This currently makes an equal-level placement report a positive drop.
- The existing shallow source opening should remain distinct from overlap removal. Removing a duplicate lower-pool region must not turn the higher basin's top notch into a full-depth hole.
