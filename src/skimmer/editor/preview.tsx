'use client'

import { useScene } from '@pascal-app/core'
import { useMemo } from 'react'
import { GeometryPreview } from '../../editor/geometry-preview'
import { getPoolNode } from '../../editor/scene-nodes'
import { buildSkimmerGeometry } from '../core/geometry'
import type { PoolSkimmerNode } from '../core/schema'
import { resolveMountedSkimmer } from '../design/placement'

export default function PoolSkimmerPreview({ node }: { node: PoolSkimmerNode }) {
  const pool = useScene((state) => getPoolNode(state.nodes, node.poolId))
  const mountedNode = useMemo(() => resolveMountedSkimmer(node, pool), [node, pool])
  return <GeometryPreview node={mountedNode} buildGeometry={buildSkimmerGeometry}>
    {mountedNode.showFlow && <FlowArrows />}
  </GeometryPreview>
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
