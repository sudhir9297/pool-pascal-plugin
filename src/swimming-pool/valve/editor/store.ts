import { create } from 'zustand'
import type { PoolValveNode } from '../core/schema'

type ValveVariant = PoolValveNode['variant']
type ValveEditState = {
  variant: ValveVariant
  setVariant: (variant: ValveVariant) => void
  rotationQuarterTurns: number
  rotate: () => void
}

export const useValveEditStore = create<ValveEditState>((set) => ({
  variant: 'two-way',
  setVariant: (variant) => set({ variant }),
  rotationQuarterTurns: 0,
  rotate: () => set((state) => ({ rotationQuarterTurns: (state.rotationQuarterTurns + 1) % 4 })),
}))
