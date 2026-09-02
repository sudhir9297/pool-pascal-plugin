import { create } from 'zustand'

type PipeExtension = {
  networkId: string
  endpointId: string
}

type PipeEditState = {
  extension: PipeExtension | null
  startPoint: [number, number, number] | null
  startDirection: [number, number, number] | null
  beginExtension: (extension: PipeExtension) => void
  beginDrawing: (point: [number, number, number]) => void
  beginDrawingFrom: (point: [number, number, number], direction: [number, number, number]) => void
  clearStartPoint: () => void
  clearExtension: () => void
}

export const usePipeEditStore = create<PipeEditState>((set) => ({
  extension: null,
  startPoint: null,
  startDirection: null,
  beginExtension: (extension) => set({ extension }),
  beginDrawing: (point) => set({ startPoint: point }),
  beginDrawingFrom: (point, direction) => set({ startPoint: point, startDirection: direction }),
  clearStartPoint: () => set({ startPoint: null }),
  clearExtension: () => set({ extension: null, startPoint: null, startDirection: null }),
}))
