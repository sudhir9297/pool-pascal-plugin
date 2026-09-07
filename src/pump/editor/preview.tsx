'use client'

import { GeometryPreview } from '../../editor/geometry-preview'
import { buildPumpGeometry } from '../core/geometry'
import type { PoolPumpNode } from '../core/schema'

export default function PoolPumpPreview({ node }: { node: PoolPumpNode }) {
  return <GeometryPreview node={node} buildGeometry={buildPumpGeometry}>
    {node.showFlow && <FlowArrows />}
  </GeometryPreview>
}

function FlowArrows() {
  return <group position={[0, 0.14, 0]}>
    <mesh rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[0.035, 0.12, 8]} /><meshBasicMaterial color="#22c55e" /></mesh>
  </group>
}
