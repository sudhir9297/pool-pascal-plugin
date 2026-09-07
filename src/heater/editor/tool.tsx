'use client'

import { FreePlacementTool, type PlacementPoint } from '../../editor/free-placement-tool'
import { DEFAULT_POOL_HEATER, PoolHeaterNode } from '../core/schema'

function createHeater(position: PlacementPoint, sequence: number) {
  return PoolHeaterNode.parse({
    ...DEFAULT_POOL_HEATER,
    id: undefined,
    name: `Pool Heater ${sequence}`,
    position,
  })
}

export default function PoolHeaterTool() {
  return <FreePlacementTool cursorColor="#f97316" kind="pool:heater" createNode={createHeater} />
}
