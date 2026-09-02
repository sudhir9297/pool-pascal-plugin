import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

/** WaterFeatures features the plugin can place. The string persists in scene JSON. */
export const WaterFeaturesPreset = z.enum(['fountain', 'spillway', 'cascade'])
export type WaterFeaturesPreset = z.infer<typeof WaterFeaturesPreset>

/** A placed waterFeatures feature — a third instanced kind alongside pools & hotTubs,
 * sharing the same instanced renderer + selection proxy via `instanced`. */
export const WaterFeaturesNode = BaseNode.extend({
  id: objectId('waterFeatures'),
  type: nodeType('pools:waterFeatures'),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  preset: WaterFeaturesPreset.default('fountain'),
  height: z.number().positive().default(0.4),
  seed: z.number().int().default(1),
  /** Blade colour (hex). Baked from the preset at placement; recolour per-feature
   * in the inspector. */
  waterColor: z.string().default('#76c7e8'),
})

export type WaterFeaturesNode = z.infer<typeof WaterFeaturesNode>
