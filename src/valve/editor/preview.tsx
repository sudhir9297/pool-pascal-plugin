'use client'

import { GeometryPreview } from '../../editor/geometry-preview'
import { buildValveGeometry } from '../core/geometry'
import type { PoolValveNode } from '../core/schema'

export default function PoolValvePreview({ node }: { node: PoolValveNode }) {
  return <GeometryPreview node={node} buildGeometry={buildValveGeometry} />
}
