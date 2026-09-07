import { create } from 'zustand'
import { DEFAULT_POOL_STAIR } from '../core/definition'
import type { PoolStairNode } from '../core/schema'
import { getPoolStairPreset, type PoolStairVariant } from '../data/catalog'

export type PoolStairPlacementSettings = Pick<
  PoolStairNode,
  'variant' | 'stepCount' | 'width' | 'depth' | 'tubeDiameter' | 'treadDepth' | 'metalColor'
>

type PoolStairStore = PoolStairPlacementSettings & {
  selectVariant: (variant: PoolStairVariant) => void
}

export const usePoolStairStore = create<PoolStairStore>((set) => ({
  variant: DEFAULT_POOL_STAIR.variant,
  stepCount: DEFAULT_POOL_STAIR.stepCount,
  width: DEFAULT_POOL_STAIR.width,
  depth: DEFAULT_POOL_STAIR.depth,
  tubeDiameter: DEFAULT_POOL_STAIR.tubeDiameter,
  treadDepth: DEFAULT_POOL_STAIR.treadDepth,
  metalColor: DEFAULT_POOL_STAIR.metalColor,
  selectVariant: (variant) => {
    const preset = getPoolStairPreset(variant)
    set({
      variant,
      stepCount: preset.stepCount,
      width: preset.width,
      depth: preset.depth,
      tubeDiameter: preset.tubeDiameter,
      treadDepth: preset.treadDepth,
    })
  },
}))

export function getPoolStairPlacementSettings(): PoolStairPlacementSettings {
  const { variant, stepCount, width, depth, tubeDiameter, treadDepth, metalColor } = usePoolStairStore.getState()
  return { variant, stepCount, width, depth, tubeDiameter, treadDepth, metalColor }
}
