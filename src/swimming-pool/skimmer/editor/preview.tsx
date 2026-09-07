'use client'

import { useNodeEvents } from '@pascal-app/viewer'
import { useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { buildSkimmerGeometry } from '../core/geometry'
import type { PoolSkimmerNode } from '../core/schema'
import { resolveMountedSkimmer } from '../design/placement'

export default function PoolSkimmerPreview({ node }: { node: PoolSkimmerNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  const pool = useScene((state) => node.poolId ? (state.nodes as unknown as Record<string, PoolSkimmerNode>)[node.poolId] : undefined)
  const mountedNode = useMemo(() => resolveMountedSkimmer(node, pool as never), [node, pool])
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildSkimmerGeometry(mountedNode), [mountedNode])
  return <group position={mountedNode.position} rotation={mountedNode.rotation} ref={rootRef} {...handlers}><primitive object={geometry} />{mountedNode.showFlow && <FlowArrows />}</group>
}

function FlowArrows() {
  return <group position={[0, 0.02, 0.16]} renderOrder={998}>
    {[0, 0.14].map((x) => <group key={x} position={[x - 0.07, 0, 0]} rotation={[0, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.16, 8]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.72} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -0.09]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.025, 0.055, 8]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.82} depthTest={false} depthWrite={false} />
      </mesh>
    </group>)}
  </group>
}
