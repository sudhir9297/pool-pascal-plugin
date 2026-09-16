'use client'

import { useFrame } from '@react-three/fiber'
import { useLiveNodeOverrides } from '@pascal-app/core'
import { useSceneAtmosphere } from '@pascal-app/viewer'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
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
import { canReuseWaterfallGeometryDuringLiveEdit, getWaterfallLiveWidthScale, resolveMountedWaterfall } from '../design/placement'
import { disposeWaterfallVisual } from './dispose-visual'

type WaterfallEffect =
  | WaterfallWaterEffect
  | WaterfallLineEffect
  | WaterfallPoolEffect
  | WaterfallBubbleCloudEffect

export default function PoolWaterfallPreview({ node }: { node: PoolWaterfallNode }) {
  const rootRef = useRef<Group>(null!)
  const atmosphere = useSceneAtmosphere()
  const handlers = usePoolNodeHost(node, rootRef)
  const pool = useAttachmentPool(node.poolId, true)
  const liveOverride = useLiveNodeOverrides((state) => state.overrides.get(node.id))
  const liveNode = useMemo(
    () => liveOverride ? { ...node, ...liveOverride } as PoolWaterfallNode : node,
    [node, liveOverride],
  )
  const committedMounted = useMemo(() => resolveMountedWaterfall(node, pool), [node, pool])
  const mounted = useMemo(() => resolveMountedWaterfall(liveNode, pool), [liveNode, pool])
  const reuseGeometry = canReuseWaterfallGeometryDuringLiveEdit(liveOverride)
  // Handle ticks are frequent. Keep the expensive rock, spillway and
  // receiving-water build keyed to the committed shape and apply live width
  // as a cheap group scale instead.
  const geometryInput = reuseGeometry ? committedMounted : mounted
  const geometry = useMemo(() => buildWaterfallGeometry(geometryInput, atmosphere), [geometryInput, atmosphere])
  const widthScale = reuseGeometry && liveOverride && 'width' in liveOverride
    ? getWaterfallLiveWidthScale(committedMounted.width, mounted.width)
    : 1
  // The temporary group scale is useful for the expensive rock and water
  // meshes, but it would stretch each instanced bubble into a large oval.
  useLayoutEffect(() => {
    const bubbleMeshes: Mesh[] = []
    geometry.traverse((child) => {
      if (child.name.startsWith('waterfall-bubble-cloud-')) bubbleMeshes.push(child as Mesh)
    })
    for (const bubble of bubbleMeshes) bubble.scale.x = 1 / widthScale
    return () => {
      for (const bubble of bubbleMeshes) bubble.scale.x = 1
    }
  }, [geometry, widthScale])
  const simulationAccumulator = useRef(0)
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
    simulationAccumulator.current += Math.min(0.05, Math.max(0, delta))
    if (simulationAccumulator.current >= 1 / 30) {
      const simulationDelta = simulationAccumulator.current
      simulationAccumulator.current = 0
      for (const effect of effects) effect.update(simulationDelta)
    }
    invalidate()
  })
  useEffect(() => () => disposeWaterfallVisual(geometry), [geometry])
  return (
    <group position={mounted.position} rotation={mounted.rotation} ref={rootRef} {...handlers}>
      <group scale={[widthScale, 1, 1]}>
        <primitive object={geometry} />
      </group>
    </group>
  )
}
