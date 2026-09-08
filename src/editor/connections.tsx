'use client'

import { findLevelAncestorId, nodeRegistry, useScene, type NodePort } from '@pascal-app/core'
import { ActionButton, ActionGroup, PanelSection } from '@pascal-app/editor'
import { useMemo, useState } from 'react'
import { planDwvConnection } from '../core/dwv-connection'
import { createPipeRoute } from './create-pipe-route'
import { connectionIndex } from './connection-index'

const socketLabel = (id: string) => id.replace(/[-_]/g, ' ').replace(/^./, (letter) => letter.toUpperCase())

export default function PoolConnections({ node }: { node: { id: string } }) {
  const nodes = useScene((s) => s.nodes)
  const index = useMemo(() => connectionIndex(nodes), [nodes])
  const selected = nodes[node.id as keyof typeof nodes]
  if (!selected || !String(selected.type).startsWith('pool:')) return null
  const ports = nodeRegistry.get(selected.type)?.ports?.(selected) ?? []
  if (!ports.length) return null
  return <PanelSection title="Connections">
    {ports.map((port) => <ConnectionForm key={`${selected.id}:${port.id}`} nodeId={selected.id} local={port} index={index} />)}
  </PanelSection>
}

function ConnectionForm({ nodeId, local, index }: { nodeId: Parameters<typeof findLevelAncestorId>[0]; local: NodePort; index: ReturnType<typeof connectionIndex> }) {
  const nodes = useScene((s) => s.nodes)
  const [target, setTarget] = useState('')
  const [message, setMessage] = useState('')
  const node = nodes[nodeId]!
  const connections = index.connectedTo(nodeId, local.id)
  const occupied = index.isOccupied(nodeId, local.id)
  const levelId = findLevelAncestorId(nodeId, nodes)
  const targets = Object.values(nodes).flatMap((other) => {
    if (!other || other.id === nodeId || other.visible === false || findLevelAncestorId(other.id, nodes) !== levelId) return []
    return (nodeRegistry.get(other.type)?.ports?.(other) ?? []).filter((p) => p.system === 'waste' || p.system === 'vent').map((port) => ({ node: other, port, key: JSON.stringify([other.id, port.id]) }))
  })
  const destination = targets.find((item) => item.key === target)
  const plan = local && destination ? planDwvConnection(local, destination.port) : null
  const create = () => {
    if (!plan || !destination || !local || !levelId) return
    try {
      const currentNodes = useScene.getState().nodes
      const currentIndex = connectionIndex(currentNodes)
      if (currentIndex.isOccupied(nodeId, local.id) || currentIndex.isOccupied(destination.node.id, destination.port.id)) {
        setMessage('This socket already touches a pipe or fitting. Disconnect it before creating another route.')
        return
      }
      const result = createPipeRoute(node, local, destination.node, destination.port)
      setMessage(`Created ${result.pipes} straight pipe sections and ${result.elbows} elbows.`)
      setTarget('')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create this pipe route.') }
  }
  const selectClassName = 'min-w-0 max-w-[65%] rounded-md border border-border/50 bg-[#2C2C2E] px-2 py-1 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-foreground/30'
  return <div className="flex flex-col gap-1.5 border-b border-border/50 pb-3 last:border-b-0 last:pb-0">
    <div className="flex items-center justify-between px-3 py-2">
      <span className="font-medium text-foreground text-xs">{socketLabel(local.id)}</span>
      <span className="text-muted-foreground text-xs">{local.diameter?.toFixed(2)}″</span>
    </div>
    {connections.length > 0 ? connections.map((connection) => {
      const other = nodes[connection.other.nodeId as keyof typeof nodes]
      const label = other ? other.name ?? nodeRegistry.get(other.type)?.presentation?.label ?? other.type : 'Deleted item'
      return <p key={connection.id} className="px-3 py-1 text-xs text-muted-foreground" role="status">
        Connected to {label} · {socketLabel(connection.other.portId)}
      </p>
    }) : occupied ? <p className="px-3 py-1 text-xs text-muted-foreground" role="status">Pipe attached · no connected item at the other end</p> : <>
    <label className="flex items-center justify-between gap-2 px-3 py-2">
      <span className="shrink-0 text-foreground/80 text-xs">Connect to</span>
      <select className={selectClassName} value={target} onChange={(e) => { setTarget(e.target.value); setMessage('') }}>
        <option value="">Choose a socket</option>
        {targets.map((item) => {
          const occupied = index.isOccupied(item.node.id, item.port.id)
          return <option key={item.key} value={item.key} disabled={occupied}>{item.node.name ?? nodeRegistry.get(item.node.type)?.presentation?.label ?? item.node.type} · {socketLabel(item.port.id)}{occupied ? ' · Connected' : ''}</option>
        })}
      </select>
    </label>
    {destination && !plan && <p className="px-3 py-1 text-xs text-muted-foreground" role="status">These socket sizes or systems do not match. An adapter is needed.</p>}
    {plan && <p className="px-3 py-1 text-xs text-muted-foreground">PVC · {plan.diameter.toFixed(2)}″ · Below-floor route with elbows</p>}
    <ActionGroup>
      <ActionButton className="disabled:pointer-events-none disabled:opacity-40" disabled={!plan} label="Create pipe" onClick={create} />
    </ActionGroup>
    </>}
    {message && <p className="px-3 py-1 text-xs text-muted-foreground" role="status">{message}</p>}
  </div>
}
