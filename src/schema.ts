import { BaseNode, nodeType, objectId } from '@pascal-app/core'
import { z } from 'zod'

/** Pool designs the plugin can place, backed by the procedural geometry family.
 * The string persists in scene JSON. */
export const PoolPreset = z.enum(['lap', 'family', 'infinity', 'plunge', 'courtyard', 'spa'])
export type PoolPreset = z.infer<typeof PoolPreset>

/** Preset size variant for the pool footprint. */
export const PoolSize = z.enum(['small', 'medium', 'large'])
export type PoolSize = z.infer<typeof PoolSize>

/** Water profile used to shape the pool surround and planting-ready edge. */
export const PoolType = z.enum(['chlorinated', 'saltwater'])
export type PoolType = z.infer<typeof PoolType>

/**
 * Schema for a placed pool. Composed from the public `BaseNode` exactly the way
 * built-in node kinds are — `objectId`/`nodeType` come from `@pascal-app/core`,
 * so a plugin needs no private host internals to mint a persistable node.
 *
 * `type` is the namespaced kind `pools:pool`. Every geometry-relevant field
 * (preset/size/waterProfile/seed/detailDensity/wallThickness/minimal/waterColor/copingColor) is
 * folded into the instancing variant key; `height`/`position`/`rotation` are
 * cheap per-instance transforms.
 */
export const PoolNode = BaseNode.extend({
  id: objectId('pool'),
  type: nodeType('pools:pool'),
  position: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  preset: PoolPreset.default('family'),
  size: PoolSize.default('medium'),
  // Overrides — all optional so an unset field inherits the procedural geometry
  // preset. Placing a pool stores
  // none of these, so a fresh pool is the pure preset; the inspector sets them.
  /** Water profile override. */
  waterProfile: PoolType.optional(),
  height: z.number().positive().default(7),
  /** Geometry-seed override. Unset ⇒ the preset's own seed (its canonical silhouette);
   *  set (e.g. via Randomize) to vary the pool. */
  seed: z.number().int().optional(),
  // Curated geometry params (folded into the instancing variant key):
  /** Detail multiplier vs the preset (1 = preset default). */
  detailDensity: z.number().min(0).max(1.5).default(1),
  /** Wall/thickness multiplier (1 = preset default). */
  wallThickness: z.number().min(0.3).max(2.5).default(1),
  /** Remove the optional edge-detail geometry. */
  minimal: z.boolean().default(false),
  /** Water tint override (hex). */
  waterColor: z.string().optional(),
  /** Coping/surround tint override (hex). */
  copingColor: z.string().optional(),
})

export type PoolNode = z.infer<typeof PoolNode>
