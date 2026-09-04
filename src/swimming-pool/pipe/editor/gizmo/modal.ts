import type { PipeGizmoAxis, PipeGizmoConstraint, PipeGizmoOperation, PipeGizmoPlane } from './types'

export const PIPE_ROTATION_SNAP_DEGREES = 45

export function pipeNumericInputFromKey(current: string, key: string): string | null {
  if (/^\d$/.test(key)) return `${current}${key}`
  if (key === '.') {
    if (current.includes('.')) return current
    if (current === '') return '0.'
    if (current === '-') return '-0.'
    return `${current}.`
  }
  if (key === '-') return current.startsWith('-') ? current.slice(1) : `-${current}`
  if (key === 'Backspace') return current.slice(0, -1)
  return null
}

export function pipeNumericValue(input: string, operation: PipeGizmoOperation): number | null {
  if (input === '' || input === '-' || input === '.' || input === '-.') return null
  const value = Number(input)
  if (!Number.isFinite(value)) return null
  return operation === 'rotate' ? (value * Math.PI) / 180 : value
}

export function pipeDisplayValue(operation: PipeGizmoOperation, value: number): string {
  const displayed = operation === 'rotate' ? (value * 180) / Math.PI : value
  return String(Math.round(displayed * 1000) / 1000)
}

export function pipeConstraintFromKey(key: string, planeLock: boolean): PipeGizmoAxis | PipeGizmoPlane | null {
  const axis = key.toLowerCase()
  if (axis !== 'x' && axis !== 'y' && axis !== 'z') return null
  if (!planeLock) return axis
  return axis === 'x' ? 'yz' : axis === 'y' ? 'xz' : 'xy'
}

export function pipeNumericDelta(
  constraint: PipeGizmoConstraint,
  pointerDelta: [number, number, number],
  distance: number,
): [number, number, number] {
  if (constraint === 'x' || constraint === 'y' || constraint === 'z') {
    return [constraint === 'x' ? distance : 0, constraint === 'y' ? distance : 0, constraint === 'z' ? distance : 0]
  }
  if (constraint === 'xy' || constraint === 'xz' || constraint === 'yz') {
    const delta = pointerDelta.map((value, index) => constraint.includes(index === 0 ? 'x' : index === 1 ? 'y' : 'z') ? value : 0) as [number, number, number]
    const length = Math.hypot(...delta)
    return length > 1e-8 ? delta.map((value) => (value / length) * distance) as [number, number, number] : [0, 0, 0]
  }
  return [distance, 0, 0]
}

export function pipeRotationPointerAngle(pivot: { x: number; y: number }, start: { x: number; y: number }, current: { x: number; y: number }): number {
  const distanceSquared = (start.x - pivot.x) ** 2 + (start.y - pivot.y) ** 2
  if (distanceSquared < 64) return (current.x - start.x - (current.y - start.y)) * 0.01
  return Math.atan2(current.y - pivot.y, current.x - pivot.x) - Math.atan2(start.y - pivot.y, start.x - pivot.x)
}

export function pipeSnapDistance(value: number, step: number): number {
  return step > 0 && Number.isFinite(step) ? Math.round(value / step) * step : value
}

export function pipeRotationSnap(angle: number, stepDegrees = PIPE_ROTATION_SNAP_DEGREES): number {
  const step = (stepDegrees * Math.PI) / 180
  return step > 0 ? Math.round(angle / step) * step : angle
}

/** Snap a planar movement vector to the nearest 45-degree direction. */
export function pipeDirectionalSnap45(
  delta: [number, number, number],
  plane: 'xy' | 'xz' = 'xz',
  threshold = Math.PI / 8,
): [number, number, number] {
  const first = plane === 'xy' ? delta[0] : delta[0]
  const second = plane === 'xy' ? delta[1] : delta[2]
  const magnitude = Math.hypot(first, second)
  if (magnitude < 1e-8) return delta
  const angle = Math.atan2(second, first)
  const step = Math.PI / 4
  const snapped = Math.round(angle / step) * step
  // Keep the motion free close to a diagonal boundary; this avoids a harsh
  // jump while the pointer is still settling onto the next direction.
  const angularError = Math.abs(Math.atan2(Math.sin(angle - snapped), Math.cos(angle - snapped)))
  if (angularError > threshold) return delta
  const result: [number, number, number] = [0, 0, 0]
  if (plane === 'xy') {
    result[0] = Math.cos(snapped) * magnitude
    result[1] = Math.sin(snapped) * magnitude
    result[2] = delta[2]
  } else {
    result[0] = Math.cos(snapped) * magnitude
    result[1] = delta[1]
    result[2] = Math.sin(snapped) * magnitude
  }
  return result
}
