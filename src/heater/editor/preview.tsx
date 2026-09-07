'use client'

import { GeometryPreview } from '../../editor/geometry-preview'
import { buildHeaterGeometry } from '../core/geometry'
import type { PoolHeaterNode } from '../core/schema'

export default function PoolHeaterPreview({ node }: { node: PoolHeaterNode }) {
  return <GeometryPreview node={node} buildGeometry={buildHeaterGeometry}>
    {node.showFlow && <mesh position={[0, node.bodyHeight * 0.16, node.bodyDepth / 2 + 0.04]}><coneGeometry args={[0.035, 0.12, 8]} /><meshBasicMaterial color="#22c55e" /></mesh>}
  </GeometryPreview>
}
