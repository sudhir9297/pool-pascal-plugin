'use client'

import { FreePlacementTool, type PlacementPoint } from '../../editor/free-placement-tool'
import { buildPumpGeometry } from '../core/geometry'
import { DEFAULT_POOL_PUMP, PoolPumpNode } from '../core/schema'

function createPump(position: PlacementPoint, sequence: number) {
  return PoolPumpNode.parse({
    ...DEFAULT_POOL_PUMP,
    id: undefined,
    name: `Pool Pump ${sequence}`,
    position,
  })
}

export default function PoolPumpTool() {
  return <FreePlacementTool cursorColor="#f97316" kind="pool:pump" createNode={createPump} buildGeometry={buildPumpGeometry} />
}
