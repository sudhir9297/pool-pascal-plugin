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

function isOpeningRelevantNode(node: AnyNode | undefined) {
  const type = node?.type as string | undefined
  return type === 'pool:pool' || type === 'slab' || type === 'building' || type === 'level'
}

function isConnectionRelevantNode(node: AnyNode | undefined) {
  const type = node?.type as string | undefined
  return type === 'pool:pool' || type === 'pool:shared-joint' || type === 'pool:spillover'
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
    const slabUpdates = syncPoolSlabOpenings(nodes)
    const groundChanges = syncPoolGroundOpenings(nodes)
    const connectionChanges = syncSharedPoolJoints(nodes)
    const spilloverChanges = syncPoolSpillovers(nodes)
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
    ) return

    syncing = true
    pauseSceneHistory(useScene)
    try {
      useScene.getState().applyNodeChanges({
        create: groundChanges.create.map((node) => ({
          node: node as unknown as AnyNode,
          parentId: node.parentId ?? undefined,
        })).concat(connectionChanges.create.map((node) => ({
          node: node as unknown as AnyNode,
          parentId: node.parentId ?? undefined,
        }))) as unknown as never,
        update: [...slabUpdates, ...groundChanges.update, ...connectionChanges.update, ...spilloverChanges.update] as never,
        delete: [...groundChanges.delete, ...connectionChanges.delete, ...spilloverChanges.delete] as never,
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
