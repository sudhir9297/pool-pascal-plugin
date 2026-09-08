'use client'

import type { PoolNode } from '../core/schema'
import { planPoolFittings } from '../design/pool-fitting-layout'

export default function PoolFittingSummary({ node }: { node: PoolNode }) {
  if (!node.automaticFittings) return null
  const plan = planPoolFittings(node)
  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      <p className="text-foreground">
        {plan.skimmers.length} skimmers · {plan.inlets.length} inlets · {plan.drains.length} drains · {plan.stair ? 1 : 0} stair
      </p>
      <p>{plan.area.toFixed(1)} m² water surface · {plan.flow.toFixed(1)} m³/h {node.fittingFlowRate > 0 ? 'specified flow' : 'estimated flow'}</p>
      <p>Flow rate 0 estimates circulation from volume and turnover hours. Set the actual maximum pump flow and the selected drain capacity when known.</p>
      <p>Turn off Automatic fittings to position or remove generated items individually. Manually added items are kept separately.</p>
      {plan.issues.map((issue) => <p key={issue} role="status">{issue}</p>)}
    </div>
  )
}
