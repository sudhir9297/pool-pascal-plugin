export const POOL_STAIR_VARIANTS = ['extended', 'classic', 'square', 'compact'] as const

export type PoolStairVariant = (typeof POOL_STAIR_VARIANTS)[number]

export type PoolStairPreset = {
  label: string
  stepCount: number
  width: number
  depth: number
  treadDepth: number
  tubeDiameter: number
  railHeight: number
  deckReach: number
  innerOffset: number
  wallBumpers: boolean
  fourDeckAnchors: boolean
}

/** Dimensions and mounting details taken from the four supplied reference photos. */
export const POOL_STAIR_CATALOG: Record<PoolStairVariant, PoolStairPreset> = {
  extended: {
    label: 'Tall angled',
    stepCount: 5,
    width: 0.5,
    depth: 1.5,
    treadDepth: 0.12,
    tubeDiameter: 0.043,
    railHeight: 1.05,
    deckReach: 0.5,
    innerOffset: 0.12,
    wallBumpers: true,
    fourDeckAnchors: false,
  },
  classic: {
    label: 'Round arch',
    stepCount: 4,
    width: 0.5,
    depth: 1.4,
    treadDepth: 0.11,
    tubeDiameter: 0.043,
    railHeight: 0.88,
    deckReach: 0.36,
    innerOffset: 0.12,
    wallBumpers: true,
    fourDeckAnchors: false,
  },
  square: {
    label: 'Low square',
    stepCount: 3,
    width: 0.52,
    depth: 1.25,
    treadDepth: 0.1,
    tubeDiameter: 0.04,
    railHeight: 0.7,
    deckReach: 0.22,
    innerOffset: 0.1,
    wallBumpers: false,
    fourDeckAnchors: true,
  },
  compact: {
    label: 'Short compact',
    stepCount: 3,
    width: 0.54,
    depth: 1.05,
    treadDepth: 0.14,
    tubeDiameter: 0.048,
    railHeight: 0.58,
    deckReach: 0.18,
    innerOffset: 0.08,
    wallBumpers: true,
    fourDeckAnchors: false,
  },
}

export function getPoolStairPreset(variant: PoolStairVariant): PoolStairPreset {
  return POOL_STAIR_CATALOG[variant]
}
