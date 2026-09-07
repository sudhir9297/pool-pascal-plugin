'use client'

import { useScene } from '@pascal-app/core'
import { useMemo } from 'react'
import { GeometryPreview } from '../../editor/geometry-preview'
import { getPoolNode } from '../../editor/scene-nodes'
import { buildInletGeometry } from '../core/geometry'
import type { PoolInletNode } from '../core/schema'
import { resolveMountedInlet } from '../design/placement'

export default function PoolInletPreview({ node }: { node: PoolInletNode }) {
  const pool = useScene((state) => getPoolNode(state.nodes, node.poolId))
  const mountedNode = useMemo(() => resolveMountedInlet(node, pool), [node, pool])
  return <GeometryPreview node={mountedNode} buildGeometry={buildInletGeometry} geometryPosition={[0, mountedNode.verticalOffset, 0]}>
    {mountedNode.showFlow && <FlowArrow length={mountedNode.flowLength} verticalOffset={mountedNode.verticalOffset} />}
  </GeometryPreview>
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
