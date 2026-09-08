'use client'

import { GeometryPreview } from '../../editor/geometry-preview'
import { buildDrainGeometry } from '../core/geometry'
import type { PoolDrainNode } from '../core/schema'
import { useAttachmentPool } from '../../editor/attachment-pool'
import { resolvePoolAttachment } from '../../design/pool-attachments'

export default function PoolDrainPreview({ node }: { node: PoolDrainNode }) {
  const pool = useAttachmentPool(node.poolId)
  const resolved = pool ? resolvePoolAttachment(node, pool) : null
  if (resolved?.type === 'pool:drain') node = resolved
  return <GeometryPreview node={node} buildGeometry={buildDrainGeometry}>
    {node.showFlow && <mesh position={[0, 0.035, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.028, 0.1, 8]} />
      <meshBasicMaterial color="#38bdf8" />
    </mesh>}
  </GeometryPreview>
}
