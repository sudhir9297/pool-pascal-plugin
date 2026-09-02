'use client'

import { getWaterFeaturesVariant, waterFeaturesVariantKey } from './waterFeatures-geometry'
import type { WaterFeaturesNode } from './waterFeatures-schema'
import { InstancedKindSystem } from './instanced'

const variantKeyOf = (node: WaterFeaturesNode) => waterFeaturesVariantKey(node.preset, node.seed, node.waterColor)
const getVariant = (node: WaterFeaturesNode) => getWaterFeaturesVariant(node)

/** Collective instanced renderer for every placed waterFeatures feature (`def.system`). */
export default function WaterFeaturesSystem() {
  return (
    <InstancedKindSystem<WaterFeaturesNode>
      getVariant={getVariant}
      kind="pools:waterFeatures"
      variantKeyOf={variantKeyOf}
    />
  )
}
