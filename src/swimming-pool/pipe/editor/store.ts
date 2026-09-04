import { create } from 'zustand'

type PipeExtension = {
  networkId: string
  endpointId: string
}

export type PipeStartConnectionKind = 'level' | 'drain'

type PipeEditState = {
  extension: PipeExtension | null
  startPoint: [number, number, number] | null
  startDirection: [number, number, number] | null
  startConnectionKind: PipeStartConnectionKind | null
  continuousDrawing: boolean
  beginExtension: (extension: PipeExtension) => void
  beginDrawing: (point: [number, number, number]) => void
  beginDrawingFrom: (point: [number, number, number], direction: [number, number, number], kind?: PipeStartConnectionKind) => void
  clearStartPoint: () => void
  clearExtension: () => void
  setContinuousDrawing: (enabled: boolean) => void
  toggleContinuousDrawing: () => boolean
}

export const usePipeEditStore = create<PipeEditState>((set) => ({
  extension: null,
  startPoint: null,
  startDirection: null,
  startConnectionKind: null,
  continuousDrawing: false,
  beginExtension: (extension) => set({ extension, startConnectionKind: null }),
  beginDrawing: (point) => set({ startPoint: point, startDirection: null, startConnectionKind: null }),
  beginDrawingFrom: (point, direction, kind = 'level') => set({ startPoint: point, startDirection: direction, startConnectionKind: kind }),
  clearStartPoint: () => set({ startPoint: null }),
  clearExtension: () => set({ extension: null, startPoint: null, startDirection: null, startConnectionKind: null }),
  setContinuousDrawing: (continuousDrawing) => set({ continuousDrawing }),
  toggleContinuousDrawing: () => {
    let next = false
    set((state) => { next = !state.continuousDrawing; return { continuousDrawing: next } })
    return next
  },
}))
