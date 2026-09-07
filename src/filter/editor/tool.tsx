'use client'

import { FreePlacementTool, type PlacementPoint } from '../../editor/free-placement-tool'
import { DEFAULT_POOL_FILTER, PoolFilterNode } from '../core/schema'

function createFilter(position: PlacementPoint, sequence: number) {
  return PoolFilterNode.parse({
    ...DEFAULT_POOL_FILTER,
    id: undefined,
    name: `Pool Filter ${sequence}`,
    position,
  })
}

export default function PoolFilterTool() {
  return <FreePlacementTool cursorColor="#2563eb" kind="pool:filter" createNode={createFilter} />
}
