'use client'

import {
  type AnyNode,
  pauseSceneHistory,
  resumeSceneHistory,
  useScene,
} from '@pascal-app/core'
import { useEffect } from 'react'
import {
  syncPoolGroundOpenings,
  syncPoolSlabOpenings,
} from '../design/opening-sync'
import { syncSharedPoolJoints } from '../design/shared-joint'
import { syncPoolSpillovers } from '../spillover/design/sync'
import { syncAutomaticPoolFittings } from '../design/sync-pool-fittings'
import { poolAttachmentUpdates } from '../design/pool-attachments'

function isOpeningRelevantNode(node: AnyNode | undefined) {
  const type = node?.type as string | undefined
  return type === 'pool:pool' || type === 'slab' || type === 'building' || type === 'level'
}

function isConnectionRelevantNode(node: AnyNode | undefined) {
  const type = node?.type as string | undefined
  return type?.startsWith('pool:') === true
}

function hasOpeningRelevantChange(
  nextNodes: Record<string, AnyNode>,
  previousNodes: Record<string, AnyNode>,
) {
  if (nextNodes === previousNodes) return false
  const ids = new Set([...Object.keys(nextNodes), ...Object.keys(previousNodes)])
  for (const id of ids) {
    const nextNode = nextNodes[id]
    const previousNode = previousNodes[id]
    if (nextNode === previousNode) continue
    if (isOpeningRelevantNode(nextNode) || isOpeningRelevantNode(previousNode)) return true
  }
  return false
}

function hasConnectionRelevantChange(
  nextNodes: Record<string, AnyNode>,
  previousNodes: Record<string, AnyNode>,
) {
  if (nextNodes === previousNodes) return false
  const ids = new Set([...Object.keys(nextNodes), ...Object.keys(previousNodes)])
  for (const id of ids) {
    const nextNode = nextNodes[id]
    const previousNode = previousNodes[id]
    if (nextNode === previousNode) continue
    if (isConnectionRelevantNode(nextNode) || isConnectionRelevantNode(previousNode)) return true
  }
  return false
}

/** Keeps the site, shadow receiver, and host slabs open beneath every pool. */
export function initializePoolOpeningSync() {
  let syncing = false

  const applyUpdates = (nodes: Record<string, AnyNode>) => {
    const fittingChanges = syncAutomaticPoolFittings(nodes)
    const fittingNodes = { ...nodes }
    for (const node of fittingChanges.create) fittingNodes[node.id] = node as unknown as AnyNode
    for (const update of fittingChanges.update) {
      fittingNodes[update.id] = { ...fittingNodes[update.id], ...update.data } as AnyNode
    }
    for (const id of fittingChanges.delete) delete fittingNodes[id]
    const attachmentUpdates = poolAttachmentUpdates(fittingNodes)
    const spilloverChanges = syncPoolSpillovers(fittingNodes)
    // Resolve spillover endpoints before deriving slab/ground openings. The
    // stored node can contain the initial placeholder position and length for
    // one render; using it here leaves the floor cut behind because this sync
    // pass suppresses its own follow-up notification.
    const resolvedNodes = { ...fittingNodes }
    for (const update of spilloverChanges.update) {
      const current = resolvedNodes[update.id]
      if (current) resolvedNodes[update.id] = { ...current, ...update.data } as AnyNode
    }
    for (const id of spilloverChanges.delete) delete resolvedNodes[id]

    const slabUpdates = syncPoolSlabOpenings(resolvedNodes)
    const groundChanges = syncPoolGroundOpenings(resolvedNodes)
    const connectionChanges = syncSharedPoolJoints(resolvedNodes)
    if (
      slabUpdates.length === 0 &&
      groundChanges.create.length === 0 &&
      groundChanges.update.length === 0 &&
      groundChanges.delete.length === 0 &&
      connectionChanges.create.length === 0 &&
      connectionChanges.update.length === 0 &&
      connectionChanges.delete.length === 0
      && spilloverChanges.update.length === 0
      && spilloverChanges.delete.length === 0
      && attachmentUpdates.length === 0
      && fittingChanges.create.length === 0
      && fittingChanges.update.length === 0
      && fittingChanges.delete.length === 0
    ) return

    syncing = true
    pauseSceneHistory(useScene)
    try {
      useScene.getState().applyNodeChanges({
        create: [...groundChanges.create, ...fittingChanges.create].map((node) => ({
          node: node as unknown as AnyNode,
          parentId: node.parentId ?? undefined,
        })).concat(connectionChanges.create.map((node) => ({
          node: node as unknown as AnyNode,
          parentId: node.parentId ?? undefined,
        }))) as unknown as never,
        update: [...slabUpdates, ...groundChanges.update, ...connectionChanges.update, ...spilloverChanges.update, ...fittingChanges.update, ...attachmentUpdates] as never,
        delete: [...groundChanges.delete, ...connectionChanges.delete, ...spilloverChanges.delete, ...fittingChanges.delete] as never,
      })
    } finally {
      resumeSceneHistory(useScene)
      syncing = false
    }
  }

  applyUpdates(useScene.getState().nodes)
  return useScene.subscribe((state, previousState) => {
    if (syncing || (
      !hasOpeningRelevantChange(state.nodes, previousState.nodes) &&
      !hasConnectionRelevantChange(state.nodes, previousState.nodes)
    )) return
    applyUpdates(state.nodes)
  })
}

export default function PoolOpeningSystem() {
  useEffect(() => initializePoolOpeningSync(), [])
  return null
}
