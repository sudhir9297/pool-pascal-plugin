'use client'

import { hotTubWaterColor, hotTubVariantKey, getHotTubVariant } from './hotTub-geometry'
import type { HotTubNode } from './hotTub-schema'
import { InstancedKindSystem } from './instanced'

const variantKeyOf = (node: HotTubNode) =>
  hotTubVariantKey(node.preset, node.seed, hotTubWaterColor(node))
const getVariant = (node: HotTubNode) => getHotTubVariant(node)

/** Collective instanced renderer for every placed hotTub (`def.system`). */
export default function HotTubsSystem() {
  return (
    <InstancedKindSystem<HotTubNode>
      getVariant={getVariant}
      kind="pools:hotTub"
      variantKeyOf={variantKeyOf}
    />
  )
}
