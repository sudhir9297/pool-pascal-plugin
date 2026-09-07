'use client'

import { useNodeEvents } from '@pascal-app/viewer'
import { useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { buildInletGeometry } from '../core/geometry'
import type { PoolInletNode } from '../core/schema'
import { resolveMountedInlet } from '../design/placement'
import type { PoolNode } from '../../core/schema'

export default function PoolInletPreview({ node }: { node: PoolInletNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  const pool = useScene((state) => node.poolId ? (state.nodes as unknown as Record<string, PoolNode>)[node.poolId] : undefined)
  const mountedNode = useMemo(() => resolveMountedInlet(node, pool), [node, pool])
  const geometry = useMemo(() => buildInletGeometry(mountedNode), [mountedNode])
  useRegistry(node.id, node.type, rootRef)
  return <group position={mountedNode.position} rotation={mountedNode.rotation} ref={rootRef} {...handlers}>
    <primitive object={geometry} position={[0, mountedNode.verticalOffset, 0]} />
    {mountedNode.showFlow && <FlowArrow length={mountedNode.flowLength} verticalOffset={mountedNode.verticalOffset} />}
  </group>
}


function FlowArrow({ length, verticalOffset }: { length: number; verticalOffset: number }) {
  return <group position={[0, verticalOffset, 0.16]} renderOrder={998}>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.008, 0.008, length, 8]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.72} depthTest={false} depthWrite={false} />
    </mesh>
    <mesh position={[0, 0, length / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.025, 0.055, 8]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.82} depthTest={false} depthWrite={false} />
    </mesh>
  </group>
}
