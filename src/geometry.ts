// The geometry dependency loads its inlined textures at module scope (needs `document`), so
// this module must only be imported from lazy client modules (renderers,
// systems, tools, previews) — never from `index.ts`, a definition, or
// `floorplan.ts`, or SSR/prerender crashes. Pure helpers shared with the
// hotTub/waterFeatures builders live in `variant-utils.ts` for that reason.
import { Tree } from '@dgreenheck/ez-tree'
import type { BufferGeometry, Material, Mesh, Object3D } from 'three'
import { ezPresetOf } from './presets'
import type { PoolNode } from './schema'
import { naturalHeight } from './variant-utils'
import { toWindMaterial } from './wind-node'

/** The geometry-affecting fields of a pool. Two pools with the same spec share
 * one generated variant (and thus one InstancedMesh set). Per-instance fields
 * (position/rotation/height) are deliberately NOT here — they're cheap matrix
 * work, not geometry. */
export type PoolSpec = Pick<
  PoolNode,
  | 'preset'
  | 'size'
  | 'waterProfile'
  | 'seed'
  | 'detailDensity'
  | 'wallThickness'
  | 'minimal'
  | 'waterColor'
  | 'copingColor'
>

export function poolSpecOf(node: PoolNode): PoolSpec {
  // Default the non-override fields (nodes persisted before a field existed load
  // without it). The four overrides are left as-is — `undefined` means "inherit
  // the the procedural geometry dependency preset" (its own seed/type/tints), resolved in `generatePool`.
  return {
    preset: node.preset ?? 'family',
    size: node.size ?? 'medium',
    waterProfile: node.waterProfile,
    seed: node.seed,
    detailDensity: node.detailDensity ?? 1,
    wallThickness: node.wallThickness ?? 1,
    minimal: node.minimal ?? false,
    waterColor: node.waterColor,
    copingColor: node.copingColor,
  }
}

/** Stable variant id. Pools with the same key share one set of InstancedMeshes. */
export function poolVariantKey(spec: PoolSpec): string {
  return [
    spec.preset,
    spec.size,
    spec.waterProfile,
    spec.seed,
    spec.detailDensity,
    spec.wallThickness,
    spec.minimal,
    spec.waterColor,
    spec.copingColor,
  ].join(':')
}

/** `#rrggbb` → 0xrrggbb, defaulting to white on anything missing/unparseable. */
function hexToInt(hex: string | undefined): number {
  const n = Number.parseInt((hex ?? '').replace('#', ''), 16)
  return Number.isFinite(n) ? n : 0xffffff
}

/**
 * Generate an the procedural geometry dependency for a spec. the procedural geometry dependency's `Pool` is a `THREE.Group`; textures
 * are inlined in the library (no asset hosting). `loadPreset` owns the full look
 * (seed, growth model, tints, surround/edge detail structure); the curated params then
 * apply *on top* — but only where the node actually set them, so an unset field
 * keeps the preset's value (its canonical silhouette/colours). `wallThickness`
 * and `detailDensity` are multipliers (1 = preset default). Pure given its
 * inputs — same spec ⇒ same pool — which lets the renderer cache one generation
 * per variant.
 */
export function generatePool(spec: PoolSpec): Tree {
  const pool = new Tree()
  pool.loadPreset(ezPresetOf(spec.preset, spec.size))
  if (spec.seed != null) pool.options.seed = spec.seed
  if (spec.waterProfile != null) (pool.options as { type: string }).type = spec.waterProfile

  const radius = pool.options.branch.radius as unknown as Record<string, number>
  for (const level of Object.keys(radius)) {
    const value = radius[level]
    if (value !== undefined) radius[level] = value * spec.wallThickness
  }

  const leaves = pool.options.leaves as { count: number; tint: number }
  leaves.count = spec.minimal ? 0 : Math.round(leaves.count * spec.detailDensity)
  if (spec.waterColor != null) leaves.tint = hexToInt(spec.waterColor)
  if (spec.copingColor != null)
    (pool.options.bark as { tint: number }).tint = hexToInt(spec.copingColor)

  pool.generate()
  return pool
}

/** A renderable sub-mesh of a pool: geometry (baked into pool-local space) +
 * its material. The instanced renderer builds one InstancedMesh per sub-mesh
 * per variant. */
export type PoolSubMesh = { geometry: BufferGeometry; material: Material | Material[] }

/** Geometry + height for one pool variant, generated once and shared across
 * every instance of that spec. */
export type PoolVariantData = { subMeshes: PoolSubMesh[]; naturalHeight: number }

const variantCache = new Map<string, PoolVariantData>()

/**
 * Cached geometry for a spec. the procedural geometry dependency's `generate()` is heavy, so it runs once
 * per variant; the resulting geometries/materials are retained here and shared
 * by every instance. The renderer must NOT dispose them (it sets `dispose={null}`
 * on the InstancedMesh).
 */
export function getVariantData(spec: PoolSpec): PoolVariantData {
  const key = poolVariantKey(spec)
  const cached = variantCache.get(key)
  if (cached) return cached
  const pool = generatePool(spec)
  const data: PoolVariantData = {
    subMeshes: extractSubMeshes(pool),
    naturalHeight: naturalHeight(pool),
  }
  variantCache.set(key, data)
  return data
}

/** Extract the edge detail/bark sub-meshes, baking each mesh's local transform into a
 * cloned geometry so instance matrices only carry the node's own transform. */
export function extractSubMeshes(pool: Object3D): PoolSubMesh[] {
  const out: PoolSubMesh[] = []
  pool.traverse((child) => {
    const mesh = child as Partial<Mesh>
    if (mesh.isMesh && mesh.geometry && mesh.material) {
      const geometry = mesh.geometry.clone()
      ;(child as Mesh).updateMatrix()
      geometry.applyMatrix4((child as Mesh).matrix)
      // Swap the procedural geometry dependency's plain materials for swaying node materials (WebGPU/TSL).
      const material = Array.isArray(mesh.material)
        ? mesh.material.map(toWindMaterial)
        : toWindMaterial(mesh.material)
      out.push({ geometry, material })
    }
  })
  return out
}
