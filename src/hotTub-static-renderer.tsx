'use client'

import { hotTubWaterColor, hotTubVariantKey, getHotTubVariant } from './hotTub-geometry'
import type { HotTubNode } from './hotTub-schema'
import { InstancedNodes } from './instanced'

const variantKeyOf = (node: HotTubNode) =>
  hotTubVariantKey(node.preset, node.seed, hotTubWaterColor(node))
const getVariant = (node: HotTubNode) => getHotTubVariant(node)

/** Collective baked-`/viewer` renderer for one level's hotTubs (`bakeReplaceRenderer`). */
export default function HotTubReplaceInstances({ nodes }: { nodes: HotTubNode[] }) {
  return (
    <InstancedNodes getVariant={getVariant} localSpace nodes={nodes} variantKeyOf={variantKeyOf} />
  )
}
