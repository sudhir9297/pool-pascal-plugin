import { create } from 'zustand'
import { DEFAULT_POOL } from '../core/definition'
import type { PoolNode } from '../core/schema'
import { DEFAULT_POOL_SHAPE_DIMENSIONS, type PoolShape } from '../design/shapes'
import type { PoolFloorProfile } from '../design/depth-profile'
import type { PoolEntryFeature } from '../design/entry-features'

type PoolSettings = Pick<PoolNode,
  | 'shape' | 'length' | 'width' | 'floorProfile' | 'depth' | 'shallowDepth' | 'deepDepth'
  | 'slopeStart' | 'slopeEnd' | 'coveRadius' | 'entryFeature' | 'entryLength'
  | 'entryWaterDepth' | 'stepCount' | 'benchEnabled' | 'benchWidth' | 'benchWaterDepth'
  | 'copingWidth' | 'copingThickness' | 'copingStyle' | 'copingStoneLength'
  | 'copingJointWidth' | 'copingIrregularity' | 'copingSeed' | 'copingColor'
  | 'shellThickness' | 'floorThickness' | 'openingClearance' | 'finishedDeckElevation'
  | 'designWaterElevation' | 'waterPreset' | 'shallowWaterColor' | 'deepWaterColor'
  | 'surfaceDetail' | 'viscosity' | 'rippleSize' | 'clarity' | 'rain' | 'breeze'
  | 'sunElevation' | 'sunAzimuth' | 'normalScale' | 'normalStrength' | 'normalSpeed'
  | 'reflectionStrength' | 'reflectionFresnel' | 'reflectionDistortion' | 'refractionStrength'
  | 'causticsStrength' | 'causticsScale' | 'causticsSpeed' | 'intersectionStrength'
  | 'intersectionColor' | 'intersectionWidth' | 'shorelineStrength' | 'shorelineWidth'
  | 'shorelineSpeed' | 'specularStrength' | 'specularSize' | 'specularHardness'
  | 'waterColor' | 'shellColor' | 'interiorFinish' | 'visualPreset'
>

type PoolWaterAction = 'splash' | 'calm' | 'storm' | 'reset'
type PoolCopingStyle = PoolNode['copingStyle']

type PoolStore = PoolSettings & {
  waterAction: { type: PoolWaterAction; nonce: number } | null
  setShape: (shape: PoolShape) => void
  setLength: (value: number) => void
  setWidth: (value: number) => void
  setCopingStyle: (value: PoolCopingStyle) => void
  setFloorProfile: (value: PoolFloorProfile) => void
  setDepth: (value: number) => void
  setShallowDepth: (value: number) => void
  setDeepDepth: (value: number) => void
  setSlopeStart: (value: number) => void
  setSlopeEnd: (value: number) => void
  setSurfaceDetail: (value: number) => void
  setViscosity: (value: number) => void
  setClarity: (value: number) => void
  setRippleSize: (value: number) => void
  setRain: (value: number) => void
  setBreeze: (value: number) => void
  setSunElevation: (value: number) => void
  setSunAzimuth: (value: number) => void
  triggerWaterAction: (type: PoolWaterAction) => void
}

export const usePoolStore = create<PoolStore>((set) => ({
  ...DEFAULT_POOL,
  waterAction: null,
  setShape: (shape) => set({ shape, ...DEFAULT_POOL_SHAPE_DIMENSIONS[shape] }),
  setLength: (length) => set({ length }),
  setWidth: (width) => set({ width }),
  setCopingStyle: (copingStyle) => set({ copingStyle }),
  setFloorProfile: (floorProfile) => set({ floorProfile }),
  setDepth: (depth) => set({ depth }),
  setShallowDepth: (shallowDepth) => set((state) => ({ shallowDepth, deepDepth: Math.max(state.deepDepth, shallowDepth) })),
  setDeepDepth: (deepDepth) => set((state) => ({ deepDepth, shallowDepth: Math.min(state.shallowDepth, deepDepth) })),
  setSlopeStart: (slopeStart) => set((state) => ({ slopeStart, slopeEnd: Math.max(state.slopeEnd, slopeStart) })),
  setSlopeEnd: (slopeEnd) => set((state) => ({ slopeEnd, slopeStart: Math.min(state.slopeStart, slopeEnd) })),
  setSurfaceDetail: (surfaceDetail) => set({ surfaceDetail }),
  setViscosity: (viscosity) => set({ viscosity }),
  setClarity: (clarity) => set({ clarity }),
  setRippleSize: (rippleSize) => set({ rippleSize }),
  setRain: (rain) => set({ rain }),
  setBreeze: (breeze) => set({ breeze }),
  setSunElevation: (sunElevation) => set({ sunElevation }),
  setSunAzimuth: (sunAzimuth) => set({ sunAzimuth }),
  triggerWaterAction: (type) => set((state) => ({ waterAction: { type, nonce: (state.waterAction?.nonce ?? 0) + 1 } })),
}))

export type { PoolShape, PoolFloorProfile, PoolEntryFeature }
