'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Group, Mesh } from 'three'
import { useAttachmentPool } from '../../../editor/attachment-pool'
import { usePoolNodeHost } from '../../../editor/node-host'
import type {
  WaterfallBubbleCloudEffect,
  WaterfallLineEffect,
  WaterfallPoolEffect,
  WaterfallWaterEffect,
} from '../../../shader/waterfall-effect'
import { buildWaterfallGeometry } from '../core/geometry'
import type { PoolWaterfallNode } from '../core/schema'
import { resolveMountedWaterfall } from '../design/placement'
import { disposeWaterfallVisual } from './dispose-visual'

type WaterfallEffect =
  | WaterfallWaterEffect
  | WaterfallLineEffect
  | WaterfallPoolEffect
  | WaterfallBubbleCloudEffect

export default function PoolWaterfallPreview({ node }: { node: PoolWaterfallNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = usePoolNodeHost(node, rootRef)
  const pool = useAttachmentPool(node.poolId)
  const mounted = useMemo(() => resolveMountedWaterfall(node, pool), [node, pool])
  const geometry = useMemo(() => buildWaterfallGeometry(mounted), [mounted])
  const effects = useMemo(() => {
    const result = [] as WaterfallEffect[]
    geometry.traverse((child) => {
      const effect = (child as Mesh).userData.waterfallEffect
      if (effect) result.push(effect)
    })
    return result
  }, [geometry])
  useFrame(({ invalidate }, delta) => {
    if (node.visible === false) return
    for (const effect of effects) effect.update(delta)
    invalidate()
  })
  useEffect(() => () => disposeWaterfallVisual(geometry), [geometry])
  return <group position={mounted.position} rotation={mounted.rotation} ref={rootRef} {...handlers}><primitive object={geometry} /></group>
}
