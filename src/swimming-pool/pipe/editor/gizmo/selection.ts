export type PipeSelectionClearState = {
  editorMode: string
  nodeSelected: boolean
  edgeSelected: boolean
  fittingSelected: boolean
  nodeClickHandled: boolean
  pipeClickHandled: boolean
}

/**
 * Pipe edges and fittings are selected locally so Delete can target a pipe
 * part instead of the whole network. Consequently an empty-canvas click must
 * clear local selection even when the viewer's global selectedIds is already
 * empty.
 */
export function shouldClearPipeSelection(state: PipeSelectionClearState): boolean {
  if (state.editorMode !== 'select') return false
  if (state.nodeClickHandled || state.pipeClickHandled) return false
  return state.nodeSelected || state.edgeSelected || state.fittingSelected
}

/**
 * Local pipe-part selection deliberately survives an empty global selection,
 * but it must never coexist with a globally selected scene node (including
 * the pipe network that owns the part).
 */
export function shouldClearLocalPipeSelectionForGlobalSelection({
  selectedCount,
}: {
  selectedCount: number
}): boolean {
  return selectedCount > 0
}
