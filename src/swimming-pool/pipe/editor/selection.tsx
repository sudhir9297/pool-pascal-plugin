'use client'

import { sceneRegistry, useScene, type AnyNodeId } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { createPortal, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import type { Group, Object3D } from 'three'
import type { PoolPipeNode } from '../core/schema'
import { OpenEndpointHandles } from './preview'

/**
 * Selection-time pipe controls live outside the selectable renderer. This is
 * important because the editor's generic selected-node click is also its
 * direct-move gesture; controls must never participate in that node event.
 */
export default function PoolPipeSelectionAffordance({ node }: { node: PoolPipeNode }) {
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const selectedNode = useScene((state) => {
    if (selectedIds.length !== 1 || selectedIds[0] !== node.id) return null
    return state.nodes[node.id as AnyNodeId] as PoolPipeNode | undefined
  })
  const [target, setTarget] = useState<Object3D | null>(null)
  const pipeId = selectedNode?.id ?? null

  useEffect(() => {
    if (!pipeId) {
      setTarget(null)
      return
    }
    let frameId = 0
    const resolve = () => {
      const next = sceneRegistry.nodes.get(pipeId) ?? null
      setTarget((current) => current === next ? current : next)
      if (!next) frameId = window.requestAnimationFrame(resolve)
    }
    resolve()
    return () => window.cancelAnimationFrame(frameId)
  }, [pipeId])

  if (!selectedNode || !target) return null
  const mount = target.parent ?? target
  return createPortal(
    <PipeSelectionRig node={selectedNode} target={target} />,
    mount,
  )
}

function PipeSelectionRig({ node, target }: { node: PoolPipeNode; target: Object3D }) {
  const outerRef = useRef<Group>(null)

  useFrame(() => {
    const outer = outerRef.current
    if (!outer) return
    outer.position.copy(target.position)
    outer.quaternion.copy(target.quaternion)
    outer.scale.copy(target.scale)
  })

  return (
    <group ref={outerRef}>
      <OpenEndpointHandles node={node} rootRef={outerRef} />
    </group>
  )
}
