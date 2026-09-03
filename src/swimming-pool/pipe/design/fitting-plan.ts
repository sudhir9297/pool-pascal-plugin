import type { PipeFittingKind, PipePoint } from '../../design/pipe-network'

export type PipeFittingPlan = {
  kind: Exclude<PipeFittingKind, 'endpoint' | 'straight' | 'corner'>
  junction: PipePoint
  portDirections: PipePoint[]
  collarPoints: PipePoint[]
  collarLength: number
}

function unit(vector: PipePoint): PipePoint {
  const length = Math.hypot(vector[0], vector[1], vector[2])
  return length > 1e-9 ? [vector[0] / length, vector[1] / length, vector[2] / length] : [1, 0, 0]
}

function collarPoints(junction: PipePoint, directions: PipePoint[], length: number): PipePoint[] {
  return directions.map((direction) => [
    junction[0] + direction[0] * length,
    junction[1] + direction[1] * length,
    junction[2] + direction[2] * length,
  ])
}

function plan(kind: PipeFittingPlan['kind'], junction: PipePoint, directions: PipePoint[], diameter: number): PipeFittingPlan {
  const portDirections = directions.map(unit)
  const collarLength = Math.max(diameter * 1.15, 0.001)
  return { kind, junction: [...junction], portDirections, collarPoints: collarPoints(junction, portDirections, collarLength), collarLength }
}

export function planPipeElbow(junction: PipePoint, first: PipePoint, second: PipePoint, diameter: number): PipeFittingPlan {
  return plan('elbow', junction, [first, second], diameter)
}

export function planPipeTee(junction: PipePoint, directions: PipePoint[], diameter: number): PipeFittingPlan | null {
  if (directions.length !== 3) return null
  return plan('tee', junction, directions, diameter)
}

export function planPipeY(junction: PipePoint, directions: PipePoint[], diameter: number): PipeFittingPlan | null {
  if (directions.length !== 3) return null
  return plan('y', junction, directions, diameter)
}

export function planPipeCross(junction: PipePoint, directions: PipePoint[], diameter: number): PipeFittingPlan | null {
  const resolved: PipePoint[] | null = directions.length >= 4 ? directions.slice(0, 4) : directions.length === 2
    ? (() => {
        const first = unit(directions[0]!)
        const perpendicular: PipePoint = [-first[2], 0, first[0]]
        return [first, [-first[0], -first[1], -first[2]], unit(perpendicular), unit([-perpendicular[0], -perpendicular[1], -perpendicular[2]])]
      })()
    : null
  return resolved ? plan('cross', junction, resolved, diameter) : null
}

export function planPipeFitting(kind: PipeFittingPlan['kind'], junction: PipePoint, directions: PipePoint[], diameter: number): PipeFittingPlan | null {
  if (kind === 'elbow') return directions.length >= 2 ? planPipeElbow(junction, directions[0]!, directions[1]!, diameter) : null
  if (kind === 'tee') return planPipeTee(junction, directions, diameter)
  if (kind === 'y') return planPipeY(junction, directions, diameter)
  return planPipeCross(junction, directions, diameter)
}
