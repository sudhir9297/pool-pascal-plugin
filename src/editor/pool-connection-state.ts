import { useScene, nodeRegistry, type AnyNode } from '@pascal-app/core'
import type { PoolPipeCircuit } from '../design/pool-pipe-layout'
import { connectionIndex } from './connection-index'

export function poolConnectionState(poolId: string, circuit: PoolPipeCircuit, nodes = useScene.getState().nodes) {
  const kind = circuit === 'inlets' ? 'pool:inlet' : circuit === 'skimmers' ? 'pool:skimmer' : 'pool:drain'
  const socket = circuit === 'inlets' ? 'return' : 'suction'
  const attachments = Object.values(nodes).filter((node) => String(node.type) === kind && 'poolId' in node && node.poolId === poolId)
  const ids = new Set(attachments.map((node) => node.id))
  const index = connectionIndex(nodes)
  const networks = attachments.map((node) => index.network(node.id, socket))
  const owned = Object.values(nodes).filter((node) => {
    if (node.type !== 'pipe-segment' && node.type !== 'pipe-fitting') return false
    const owner = node.metadata?.poolConnection
    return owner && typeof owner === 'object' && 'poolId' in owner && 'circuit' in owner && owner.poolId === poolId && owner.circuit === circuit
  })
  const pipeIds = [...new Set([...networks.flatMap((network) => network.pipeIds), ...owned.map((node) => node.id)])]
  const occupied = attachments.filter((node) => index.isOccupied(node.id, socket)).length
  const connected = occupied === attachments.length && occupied > 0 && networks.every((network) => networks[0]!.pipeIds.some((id) => network.pipeIds.includes(id)))
  const ownedNetworks = owned.flatMap((node) => {
    const port = nodeRegistry.get(node.type)?.ports?.(node)?.[0]
    return port ? [index.network(node.id, port.id)] : []
  })
  const shared = [...networks, ...ownedNetworks].some((network) => network.endpoints.some(({ other }) => {
    const node = nodes[other.nodeId as AnyNode['id']]
    return node && ['pool:inlet', 'pool:skimmer', 'pool:drain'].includes(String(node.type)) && !ids.has(node.id)
  }))
  return { status: connected ? 'connected' : occupied > 0 || pipeIds.length > 0 ? 'partial' : 'empty', pipeIds, shared } as const
}

export function deletePoolConnection(poolId: string, circuit: PoolPipeCircuit) {
  const scene = useScene.getState()
  if (scene.readOnly) throw new Error('This scene is read-only.')
  const state = poolConnectionState(poolId, circuit, scene.nodes)
  if (state.shared) throw new Error('This pipe network serves other pool connections. Separate the shared branch before deleting it.')
  if (state.pipeIds.length) scene.applyNodeChanges({ delete: state.pipeIds as AnyNode['id'][] })
}
