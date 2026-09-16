'use client'

import { useCallback, useMemo } from 'react'
import { GeometryPreview } from '../../editor/geometry-preview'
import { useAttachmentPool } from '../../editor/attachment-pool'
import { buildPoolStairGeometry } from '../core/geometry'
import type { PoolStairNode } from '../core/schema'
import { resolvePoolStairMounting } from '../design/mounting'
import { resolveMountedPoolStair } from '../design/placement'

export default function PoolStairPreview({ node }: { node: PoolStairNode }) {
  const pool = useAttachmentPool(node.poolId, true)
  const committedPool = useAttachmentPool(node.poolId)
  const mounted = useMemo(() => resolveMountedPoolStair(node, pool), [node, pool])
  const committedMounted = useMemo(() => resolveMountedPoolStair(node, committedPool), [node, committedPool])
  const buildGeometry = useCallback(
    (value: PoolStairNode) => buildPoolStairGeometry(value, resolvePoolStairMounting(value, committedPool)),
    [committedPool],
  )
  return <GeometryPreview node={mounted} geometryNode={committedMounted} buildGeometry={buildGeometry} />
}
