import { derivePipeFittingKind, type PipeNetwork, type PipePoint } from '../../../design/pipe-network'
import type { PipeGizmoAxis } from './types'

export type PipeFittingGizmoTarget = {
  nodeId: string
  kind: 'elbow' | 'tee' | 'y' | 'cross'
  position: PipePoint
  validAxes: PipeGizmoAxis[]
  rotationAxes: PipeGizmoAxis[]
}

function dominantAxis(direction: PipePoint): PipeGizmoAxis {
  const absolute = [Math.abs(direction[0]!), Math.abs(direction[1]!), Math.abs(direction[2]!)]
  return absolute[0]! >= absolute[1]! && absolute[0]! >= absolute[2]! ? 'x' : absolute[1]! >= absolute[2]! ? 'y' : 'z'
}

/** Resolve the transform directions that preserve a fitting's local layout. */
export function getPipeFittingGizmoTarget(network: PipeNetwork, nodeId: string): PipeFittingGizmoTarget | null {
  const node = network.nodes.find((candidate) => candidate.id === nodeId)
  if (!node) return null
  // Rendering derives the fitting kind from live topology. Do the same for
  // gizmo targeting so legacy `corner`/stale node kinds cannot produce a
  // visible fitting that silently has no gizmo.
  const kind = node.kind === 'cross' ? 'cross' : derivePipeFittingKind(network, nodeId)
  if (kind !== 'elbow' && kind !== 'tee' && kind !== 'y' && kind !== 'cross') return null
  const edges = network.edges.filter((edge) => edge.from === nodeId || edge.to === nodeId)
  const directions = edges.map((edge) => {
    const neighborId = edge.from === nodeId ? edge.to : edge.from
    const neighbor = network.nodes.find((candidate) => candidate.id === neighborId)
    return neighbor ? [neighbor.position[0] - node.position[0], neighbor.position[1] - node.position[1], neighbor.position[2] - node.position[2]] as PipePoint : null
  }).filter((direction): direction is PipePoint => direction !== null)
  const axes = [...new Set(directions.map(dominantAxis))] as PipeGizmoAxis[]
  return {
    nodeId,
    kind,
    position: [...node.position],
    validAxes: axes.length > 0 ? axes : ['x', 'y', 'z'],
    rotationAxes: kind === 'elbow' ? axes : ['x', 'y', 'z'],
  }
}
