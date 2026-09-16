import type { SceneAtmosphereSource } from '@pascal-app/viewer'
import type { PoolOverlap } from '../design/pool-overlap'
import { getPoolDepthRange, getPoolDepthResolver } from '../design/depth-profile'
import { buildPoolOutlines } from '../design/outlines'
import type { SpilloverNotch } from '../design/spillover-notch'
import { PoolNode, resolvePoolPolygon, type PoolPoint } from './schema'

export type PoolGeometryOptions = {
  overlaps?: PoolOverlap[]
  spilloverNotches?: SpilloverNotch[]
  removeWallRegions?: PoolPoint[][]
  removeWallCapRegions?: PoolPoint[][]
  removeFloorRegions?: PoolPoint[][]
  removeWaterRegions?: PoolPoint[][]
  waterResolution?: number
  atmosphere?: SceneAtmosphereSource | null
}

export function createPoolAssemblyPlan(nodeInput: PoolNode, input: PoolGeometryOptions = {}) {
  const node = PoolNode.parse(nodeInput)
  const overlapRegions = input.overlaps?.filter(overlap => overlap.trimBasin !== false).flatMap(overlap => overlap.regions) ?? []
  const overlapWallRegions = input.overlaps
    ?.filter(overlap => overlap.trimBasin !== false)
    .flatMap(overlap => overlap.wallRegions ?? overlap.regions) ?? []
  const overlapWallCapRegions = input.overlaps
    ?.filter(overlap => overlap.trimBasin !== false)
    .flatMap(overlap => overlap.wallCapRegions ?? overlap.wallRegions ?? overlap.regions) ?? []
  const overlapWaterRegions = input.overlaps
    ?.filter(overlap => overlap.trimBasin !== false && overlap.preserveWater !== true)
    .flatMap(overlap => overlap.regions) ?? []
  const options: PoolGeometryOptions = {
    ...input,
    removeWallRegions: [...(input.removeWallRegions ?? []), ...overlapWallRegions],
    removeWallCapRegions: [...(input.removeWallCapRegions ?? []), ...overlapWallCapRegions],
    removeFloorRegions: [...(input.removeFloorRegions ?? []), ...overlapRegions],
    removeWaterRegions: [...(input.removeWaterRegions ?? []), ...overlapWaterRegions],
  }
  const sourceOutline = resolvePoolPolygon(node)
  const safeCoveRadius = Math.min(node.coveRadius, getPoolDepthRange(node).minimum * 0.45)
  const outlines = buildPoolOutlines(sourceOutline, {
    shellThickness: node.shellThickness,
    copingWidth: node.copingWidth,
    coveRadius: safeCoveRadius,
    openingClearance: node.openingClearance,
  })
  const inner = outlines.basin
  const depth = getPoolDepthResolver(node, inner)
  const cuts = depth.profile.kind === 'shallow-to-deep'
    ? [
        depth.minimumX + (depth.maximumX - depth.minimumX) * depth.profile.slopeStart / 100,
        depth.minimumX + (depth.maximumX - depth.minimumX) * depth.profile.slopeEnd / 100,
      ]
    : []
  return {
    node,
    options,
    outlines,
    inner,
    depth,
    cuts,
    waterElevation: node.designWaterElevation,
    safeCoveRadius,
  }
}
