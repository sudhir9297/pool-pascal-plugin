'use client'

import { useScene } from '@pascal-app/core'
import { useCallback, useMemo } from 'react'
import { GeometryPreview } from '../../editor/geometry-preview'
import { getPoolNode } from '../../editor/scene-nodes'
import { buildPoolStairGeometry } from '../core/geometry'
import type { PoolStairNode } from '../core/schema'
import { resolvePoolStairMounting } from '../design/mounting'
import { resolveMountedPoolStair } from '../design/placement'

export default function PoolStairPreview({ node }: { node: PoolStairNode }) {
  const pool = useScene((state) => getPoolNode(state.nodes, node.poolId))
  const mounted = useMemo(() => resolveMountedPoolStair(node, pool), [node, pool])
  const buildGeometry = useCallback(
    (value: PoolStairNode) => buildPoolStairGeometry(value, resolvePoolStairMounting(value, pool)),
    [pool],
  )
  return <GeometryPreview node={mounted} buildGeometry={buildGeometry} />
}
