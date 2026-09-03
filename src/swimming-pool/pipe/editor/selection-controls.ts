import type { PoolPipeNode } from '../core/schema'

export type SelectedEdgeEndpointControl = {
  endpointId: string
  position: [number, number, number]
  direction: [number, number, number]
}

export type SelectedFittingControl = {
  nodeId: string
  position: [number, number, number]
}

export function getPipeGizmoDirections(outward: readonly [number, number, number]): {
  red: [number, number, number]
  green: [number, number, number]
  blue: [number, number, number]
} {
  const length = Math.hypot(outward[0], outward[1], outward[2])
  const red: [number, number, number] = length > Number.EPSILON
    ? [outward[0] / length, outward[1] / length, outward[2] / length]
    : [1, 0, 0]
  const green: [number, number, number] = [0, 1, 0]
  let blue: [number, number, number] = [-red[2], 0, red[0]]
  const blueLength = Math.hypot(blue[0], blue[2])
  blue = blueLength > Number.EPSILON
    ? [blue[0] / blueLength, 0, blue[2] / blueLength]
    : [0, 0, 1]
  return { red, green, blue }
}

/**
 * Derives the endpoint controls owned by one selected PVC edge. A selected
 * edge may expose only its own open graph endpoints; junctions and endpoints
 * belonging to neighbouring edges never leak into the control rig.
 */
export function getSelectedEdgeEndpointControls(
  network: PoolPipeNode,
  selectedEdgeId: string,
): SelectedEdgeEndpointControl[] {
  const selectedEdge = network.edges.find((edge) => edge.id === selectedEdgeId)
  if (!selectedEdge || selectedEdge.style !== 'rigid') return []

  const nodesById = new Map(network.nodes.map((node) => [node.id, node]))
  const degreeByNode = new Map<string, number>()
  for (const edge of network.edges) {
    degreeByNode.set(edge.from, (degreeByNode.get(edge.from) ?? 0) + 1)
    degreeByNode.set(edge.to, (degreeByNode.get(edge.to) ?? 0) + 1)
  }

  const controls: SelectedEdgeEndpointControl[] = []
  for (const endpointId of [selectedEdge.from, selectedEdge.to]) {
    const endpoint = nodesById.get(endpointId)
    if (!endpoint || endpoint.kind !== 'endpoint' || degreeByNode.get(endpointId) !== 1) continue

    const neighborId = selectedEdge.from === endpointId ? selectedEdge.to : selectedEdge.from
    const neighbor = nodesById.get(neighborId)
    if (!neighbor) continue

    const dx = endpoint.position[0] - neighbor.position[0]
    const dy = endpoint.position[1] - neighbor.position[1]
    const dz = endpoint.position[2] - neighbor.position[2]
    const length = Math.hypot(dx, dy, dz)
    if (length <= Number.EPSILON) continue

    controls.push({
      endpointId,
      position: [...endpoint.position],
      direction: [dx / length, dy / length, dz / length],
    })
  }

  return controls
}

export function getSelectedEdgeFittingControls(
  network: PoolPipeNode,
  selectedEdgeId: string,
): SelectedFittingControl[] {
  const selectedEdge = network.edges.find((edge) => edge.id === selectedEdgeId)
  if (!selectedEdge) return []
  const fittingIds = new Set([selectedEdge.from, selectedEdge.to])
  return network.nodes
    .filter((node) => fittingIds.has(node.id) && node.kind !== 'endpoint' && node.kind !== 'straight')
    .map((node) => ({ nodeId: node.id, position: [...node.position] as [number, number, number] }))
}
