import type { PoolNode } from '../../core/schema'
import type { PoolStairNode } from '../core/schema'
import { getPoolStairPreset } from '../data/catalog'

export type PoolStairMounting = {
  deckReach: number
  innerOffset: number
  railHeight: number
}

const DECK_ANCHOR_RADIUS = 0.085
const CLEARANCE = 0.04

const isSmoothPool = (pool: PoolNode) => (
  pool.shape === 'spline'
  || pool.shape === 'kidney'
  || pool.shape === 'lagoon'
  || pool.shape === 'roman'
)

/** Keeps both stair legs outside rock coping while the handrail crosses above it. */
export function resolvePoolStairMounting(
  stair: PoolStairNode,
  pool?: PoolNode,
): PoolStairMounting {
  const preset = getPoolStairPreset(stair.variant)
  if (!pool || pool.copingStyle !== 'rock') return {
    deckReach: preset.deckReach,
    innerOffset: preset.innerOffset,
    railHeight: preset.railHeight,
  }

  const irregularity = Math.max(0, Math.min(1, pool.copingIrregularity))
  const copingWidth = Math.max(pool.copingWidth, pool.shellThickness + 0.03)
  const widestStone = copingWidth * (1 + irregularity * 0.14)

  let outerRockEdge: number
  let innerRockEdge: number
  if (isSmoothPool(pool)) {
    const curvedStoneWidth = Math.max(widestStone * 1.5, pool.copingStoneLength * 0.9)
    outerRockEdge = curvedStoneWidth * 0.68 + 0.09
    innerRockEdge = curvedStoneWidth * 0.44 + 0.09
  } else {
    const renderedStoneWidth = widestStone * 1.06
    outerRockEdge = renderedStoneWidth * 0.6 + 0.14
    innerRockEdge = Math.max(0, renderedStoneWidth * 0.5 + 0.02)
  }

  const tubeRadius = stair.tubeDiameter / 2
  const rockTop = pool.copingThickness * (1 + irregularity * 0.15) + 0.07
  const crossoverFraction = stair.variant === 'square'
    ? 1
    : stair.variant === 'compact'
      ? 0.5
      : 0.58

  return {
    deckReach: Math.max(preset.deckReach, outerRockEdge + DECK_ANCHOR_RADIUS + CLEARANCE),
    innerOffset: Math.max(preset.innerOffset, innerRockEdge + tubeRadius + CLEARANCE),
    railHeight: Math.max(preset.railHeight, (rockTop + tubeRadius + CLEARANCE) / crossoverFraction),
  }
}
