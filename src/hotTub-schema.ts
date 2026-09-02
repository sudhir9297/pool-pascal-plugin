import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

/** HotTub silhouettes the plugin can place. The string persists in scene JSON. */
export const HotTubPreset = z.enum(['spa', 'therapy', 'plunge'])
export type HotTubPreset = z.infer<typeof HotTubPreset>

/** A placed hotTub — a sibling instanced kind to the pool, sharing the same
 * instanced renderer + selection proxy via the generic `instanced` core. */
export const HotTubNode = BaseNode.extend({
  id: objectId('hotTub'),
  type: nodeType('pools:hotTub'),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  preset: HotTubPreset.default('spa'),
  height: z.number().positive().default(0.5),
  seed: z.number().int().default(1),
  /** Petal colour (hex). Baked from the preset at placement; recolour per-hotTub
   * in the inspector (the hotTub analog of the pool's edge detail tint). */
  waterColor: z.string().default('#d8f3ff'),
})

export type HotTubNode = z.infer<typeof HotTubNode>
