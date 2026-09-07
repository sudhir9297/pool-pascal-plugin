'use client'

import { type AnyNodeId, sceneRegistry } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { type ReactNode, useEffect, useRef } from 'react'
import type { Group } from 'three'

export function copyPoolLevelWorldTransform(target: Group, level: Group | null | undefined) {
  if (!level) {
    target.position.set(0, 0, 0)
    target.quaternion.identity()
    target.scale.set(1, 1, 1)
    return
  }
  level.updateWorldMatrix(true, false)
  level.matrixWorld.decompose(target.position, target.quaternion, target.scale)
}

/** Keeps pool-tool ghosts in the active level's stacked coordinate frame. */
export function PoolLevelPreviewGroup({ children }: { children: ReactNode }) {
  const levelId = useViewer((state) => state.selection.levelId)
  const ref = useRef<Group>(null)

  useEffect(() => {
    let frame = 0
    const sync = () => {
      const group = ref.current
      if (group) {
        const level = levelId ? sceneRegistry.nodes.get(levelId as AnyNodeId) : null
        copyPoolLevelWorldTransform(group, level as Group | null | undefined)
      }
      frame = requestAnimationFrame(sync)
    }
    frame = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(frame)
  }, [levelId])

  return <group ref={ref}>{children}</group>
}
