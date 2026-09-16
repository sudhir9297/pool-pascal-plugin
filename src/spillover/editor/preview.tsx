'use client'

import { useLiveNodeOverrides, useScene } from '@pascal-app/core'
import { useFrame } from '@react-three/fiber'
import { useSceneAtmosphere } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef } from 'react'
import { Group } from 'three'
import { PoolNode } from '../../core/schema'
import { usePoolNodeHost } from '../../editor/node-host'
import { buildPoolSpilloverGeometry } from '../core/geometry'
import type { PoolSpilloverNode } from '../core/schema'
import { resolvePoolSpilloverSyncUpdate } from '../design/sync'
import { disposePoolSpilloverVisual } from './dispose-visual'

export default function PoolSpilloverPreview({ node }: { node: PoolSpilloverNode }) {
  const rootRef = useRef<Group>(null!)
  const atmosphere = useSceneAtmosphere()
  const handlers = usePoolNodeHost(node, rootRef)
  const sourceValue = useScene((state) => state.nodes[node.sourcePoolId as never])
  const targetValue = useScene((state) => state.nodes[node.targetPoolId as never])
  const livePoolOverrides = useLiveNodeOverrides((state) => [
    state.get(node.sourcePoolId), state.get(node.targetPoolId),
  ])
  const editInProgress = useLiveNodeOverrides((state) => Boolean(state.get(node.id)))
  const liveNode = useMemo(() => {
    if (editInProgress) return null
    const source = PoolNode.safeParse(sourceValue ? { ...sourceValue, ...livePoolOverrides[0] } : sourceValue)
    const target = PoolNode.safeParse(targetValue ? { ...targetValue, ...livePoolOverrides[1] } : targetValue)
    if (!source.success || !target.success) return null
    const update = resolvePoolSpilloverSyncUpdate(node, source.data, target.data)
    return update ? { ...node, ...update } : null
  }, [editInProgress, livePoolOverrides, node, sourceValue, targetValue])
  const geometry = useMemo(
    () => {
      if (!liveNode) return new Group()
      const sourceValueWithOverride = liveNode.sourcePoolId === node.sourcePoolId
        ? (sourceValue ? { ...sourceValue, ...livePoolOverrides[0] } : sourceValue)
        : (targetValue ? { ...targetValue, ...livePoolOverrides[1] } : targetValue)
      const source = PoolNode.safeParse(sourceValueWithOverride)
      return buildPoolSpilloverGeometry(
        liveNode,
        source.success ? source.data : undefined,
        atmosphere,
      )
    },
    [liveNode, node.sourcePoolId, sourceValue, targetValue, livePoolOverrides, atmosphere],
  )
  useFrame(({ invalidate }, delta) => {
    if (!liveNode || editInProgress || node.visible === false) return
    for (const effect of geometry.userData.waterEffects ?? []) effect.update(delta)
    invalidate()
  })
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
