import type { PipeGizmoAxis, PipeGizmoConstraint, PipeGizmoOperation, PipeGizmoPlane, PipeGizmoVisualState, PipeActiveGizmoTransform } from './types'

export const PIPE_AXIS_COLORS: Record<PipeGizmoAxis, string> = {
  x: '#ff2060',
  y: '#20df80',
  z: '#2080ff',
}

export const PIPE_GIZMO_HOVER_COLOR = '#ffff40'
export const PIPE_GIZMO_RENDER_ORDER = 1300
export const PIPE_GIZMO_HIT_RENDER_ORDER = PIPE_GIZMO_RENDER_ORDER + 1

export function pipeAxisVisualState(
  active: PipeActiveGizmoTransform | null,
  operation: PipeGizmoOperation,
  axis: PipeGizmoAxis,
): PipeGizmoVisualState {
  if (!active) return 'normal'
  if (active.operation !== operation) return 'faded'
  if (active.constraint === 'free') return 'normal'
  if (active.constraint.length === 2) return active.constraint.includes(axis) ? 'active' : 'faded'
  return active.constraint === axis ? 'active' : 'faded'
}

export function pipePlaneVisualState(
  active: PipeActiveGizmoTransform | null,
  plane: PipeGizmoPlane,
): PipeGizmoVisualState {
  if (!active) return 'normal'
  if (active.operation !== 'translate' || active.constraint === 'free') return 'faded'
  return active.constraint === plane ? 'active' : 'faded'
}

export function pipeTransformAxisFromKey(key: string): PipeGizmoAxis | null {
  const normalized = key.toLowerCase()
  return normalized === 'x' || normalized === 'y' || normalized === 'z' ? normalized : null
}

export function pipeTransformConstraintFromKey(key: string, planeLock: boolean): PipeGizmoAxis | PipeGizmoPlane | null {
  const axis = pipeTransformAxisFromKey(key)
  if (!axis || !planeLock) return axis
  return axis === 'x' ? 'yz' : axis === 'y' ? 'xz' : 'xy'
}

export function pipeAxisDelta(axis: PipeGizmoAxis, distance: number): [number, number, number] {
  return [axis === 'x' ? distance : 0, axis === 'y' ? distance : 0, axis === 'z' ? distance : 0]
}

export function pipeConstrainTranslationDelta(
  delta: [number, number, number],
  constraint: PipeGizmoConstraint,
): [number, number, number] {
  if (constraint === 'free') return delta
  return delta.map((value, index) => {
    const axis = index === 0 ? 'x' : index === 1 ? 'y' : 'z'
    return constraint.includes(axis) ? value : 0
  }) as [number, number, number]
}
