'use client'

import { GeometryPreview } from '../../editor/geometry-preview'
import { buildDrainGeometry } from '../core/geometry'
import type { PoolDrainNode } from '../core/schema'

export default function PoolDrainPreview({ node }: { node: PoolDrainNode }) {
  return <GeometryPreview node={node} buildGeometry={buildDrainGeometry}>
    {node.showFlow && <mesh position={[0, 0.035, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.028, 0.1, 8]} />
      <meshBasicMaterial color="#38bdf8" />
    </mesh>}
  </GeometryPreview>
}
