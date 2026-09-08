# Intersecting pools and spillovers

Research checked 2026-09-07. Implementation status was reconciled with the code
on 2026-09-08. This note separates external examples, the plugin's modeling
policy, and current behavior.

## External examples

- An attached raised spa retains a separating dam wall. Its spillway is a local
  opening near the top of that wall rather than a full-depth opening.
  [Splash Pools, attached spas and dam walls](https://www.splashpoolsllc.com/spa-remodeling-naples/)
- Integrated pool and spa combinations can place both basins inside one plan and
  pump water into the raised spa so it overflows into the pool.
  [River Pools, pool and spa designs](https://www.riverpoolsandspas.com/blog/pool-and-spa-designs-decide-what-is-best-for-your-yard)
- Raised spillover spas can be built into the pool structure while maintaining
  two water levels.
  [Aqualis Pools, spillover spas](https://aqualispoolsllc.com/spillover-spa/)
- Flush and level-spillway designs are a separate case and do not require a tall
  falling sheet.
  [California Pools, level spas](https://www.calpool.com/level-spa/)

These examples inform appearance only. They do not define how a modeling tool
must divide two arbitrary intersecting polygons.

## Plugin modeling policy

For pools with different world water elevations:

1. The higher pool is the source and the lower pool is the target.
2. The source basin keeps its separating shell and floor.
3. The spillover cuts shallow, width-limited openings and builds a lip or channel.
4. Curved, rotated, adjacent, overlapping, and nested outlines use the same
   placement policy.
5. A spillover owns its connection pair, so a generated shared joint must not
   also carve a full-depth opening between the same pools.

For intersecting pools at the same water elevation, the connection uses
`mergedSurface`. The pool-owned surface is continuous and the falling connector
mesh is suppressed. The saved node retains a minimum `dropHeight` of 0.02 metres
for schema compatibility, but that value does not create a visible falling sheet
in merged-surface mode.

## Current implementation

- `src/spillover/design/placement.ts` selects source and target, resolves curved
  or straight edges, calculates openings, and sets `mergedSurface`.
- `src/design/shared-joint.ts` includes spillovers as connection points but limits
  full-depth overlap removal to shared joints. A spillover suppresses a stale
  shared joint for the same pool pair.
- `src/design/spillover-notch.ts` calculates the shallow source notch.
- `src/editor/renderer.tsx` applies shared-joint removal regions separately from
  spillover notches.
- Placement and synchronization tests cover adjacent, overlapping, same-level,
  curved, rotated, nested, moved, removed, and cross-level cases.

## Remaining limits

The model is visual. It does not calculate weir flow, pump capacity, splash,
water loss, waterproofing, or structural reinforcement. Fully coincident pools
are rejected because they do not define a useful connection edge.
