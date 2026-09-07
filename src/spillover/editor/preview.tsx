'use client'

import { useLiveNodeOverrides, useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Group } from 'three'
import { subscribeWaterfallAnimation } from '../../shader/waterfall-animation'
import { PoolNode } from '../../core/schema'
import { buildPoolSpilloverGeometry } from '../core/geometry'
import type { PoolSpilloverNode } from '../core/schema'
import { resolvePoolSpilloverSyncUpdate } from '../design/sync'
import { disposePoolSpilloverVisual } from './dispose-visual'

export default function PoolSpilloverPreview({ node }: { node: PoolSpilloverNode }) {
  const [, redraw] = useState(0)
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  const sourceValue = useScene((state) => state.nodes[node.sourcePoolId as never])
  const targetValue = useScene((state) => state.nodes[node.targetPoolId as never])
  const editInProgress = useLiveNodeOverrides((state) => Boolean(
    state.get(node.id) || state.get(node.sourcePoolId) || state.get(node.targetPoolId),
  ))
  const liveNode = useMemo(() => {
    if (editInProgress) return null
    const source = PoolNode.safeParse(sourceValue)
    const target = PoolNode.safeParse(targetValue)
    if (!source.success || !target.success) return null
    const update = resolvePoolSpilloverSyncUpdate(node, source.data, target.data)
    return update ? { ...node, ...update } : null
  }, [node, sourceValue, targetValue, editInProgress])
  const geometry = useMemo(
    () => {
      if (!liveNode) return new Group()
      const source = PoolNode.safeParse(liveNode.sourcePoolId === node.sourcePoolId ? sourceValue : targetValue)
      return buildPoolSpilloverGeometry(liveNode, source.success ? source.data : undefined)
    },
    [liveNode, node.sourcePoolId, sourceValue, targetValue],
  )
  useRegistry(node.id, node.type, rootRef)
  useEffect(() => {
    return subscribeWaterfallAnimation((delta) => {
      for (const effect of geometry.userData.waterEffects ?? []) effect.update(delta)
      redraw((value) => (value + 1) % 1000000)
    })
  }, [geometry])
  useEffect(() => () => disposePoolSpilloverVisual(geometry), [geometry])
  return (
    <group
      ref={rootRef}
      position={liveNode?.position ?? node.position}
      rotation={liveNode?.rotation ?? node.rotation}
      visible={!editInProgress && Boolean(liveNode)}
      {...handlers}
    >
      <primitive object={geometry} />
    </group>
  )
}
