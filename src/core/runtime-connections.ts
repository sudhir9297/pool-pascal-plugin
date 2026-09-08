import type { NodePort } from '@pascal-app/core'

export type ConnectionNode = { id: string; type: string; levelId: string | null; ports: readonly NodePort[] }
const tolerance = 0.001
const key = (nodeId: string, portId: string) => JSON.stringify([nodeId, portId])

/** Derived only from current sockets. Equipment ports are endpoints, never internal shortcuts. */
export function runtimeConnections(nodes: readonly ConnectionNode[]) {
  const sockets = nodes.flatMap((node) => node.ports.map((port) => ({ node, port, id: key(node.id, port.id) })))
  const byId = new Map(sockets.map((socket) => [socket.id, socket]))
  const edges = new Map(sockets.map((socket) => [socket.id, new Set<string>()]))
  const occupied = new Set<string>()
  const buckets = new Map<string, typeof sockets>()
  const bucketKey = (level: string, x: number, y: number, z: number) => JSON.stringify([level, x, y, z])
  for (const socket of sockets) {
    if (!socket.node.levelId || !socket.port.position.every(Number.isFinite)) continue
    const [x, y, z] = socket.port.position.map((value) => Math.floor(value / tolerance)) as [number, number, number]
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const other of buckets.get(bucketKey(socket.node.levelId, x + dx, y + dy, z + dz)) ?? []) {
        const a = socket.port, b = other.port
        if (socket.node.id === other.node.id || a.system !== b.system || !['waste', 'vent'].includes(a.system ?? '')) continue
        if (!a.diameter || !b.diameter || Math.abs(a.diameter - b.diameter) > 0.001) continue
        if ((a.shape ?? 'round') !== (b.shape ?? 'round')) continue
        if (Math.hypot(...a.position.map((value, axis) => value - b.position[axis]!)) > tolerance) continue
        edges.get(socket.id)!.add(other.id); edges.get(other.id)!.add(socket.id)
        occupied.add(socket.id); occupied.add(other.id)
      }
    }
    const bucket = bucketKey(socket.node.levelId, x, y, z)
    buckets.set(bucket, [...(buckets.get(bucket) ?? []), socket])
  }
  for (const node of nodes) {
    if (!['pipe-segment', 'pipe-fitting'].includes(node.type)) continue
    for (const a of node.ports) for (const b of node.ports) {
      if (a.id !== b.id) edges.get(key(node.id, a.id))!.add(key(node.id, b.id))
    }
  }
  return {
    isOccupied: (nodeId: string, portId: string) => occupied.has(key(nodeId, portId)),
    connectedTo(nodeId: string, portId: string) {
      const start = key(nodeId, portId), visited = new Set([start]), queue = [start]
      const result: Array<{ id: string; other: { nodeId: string; portId: string } }> = []
      for (let i = 0; i < queue.length; i++) {
        for (const next of edges.get(queue[i]!) ?? []) {
          if (visited.has(next)) continue
          visited.add(next)
          const socket = byId.get(next)!
          if (!['pipe-segment', 'pipe-fitting'].includes(socket.node.type)) {
            if (socket.node.id !== nodeId) result.push({ id: next, other: { nodeId: socket.node.id, portId: socket.port.id } })
          } else queue.push(next)
        }
      }
      return result
    },
  }
}
