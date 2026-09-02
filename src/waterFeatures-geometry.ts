import { type BufferGeometry, ConeGeometry, DoubleSide, Group, Mesh } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { WATER_FEATURE_PRESETS } from './waterFeatures-presets'
import type { WaterFeaturesNode, WaterFeaturesPreset } from './waterFeatures-schema'
import type { SubMesh, VariantData } from './instanced'
import { mulberry32, naturalHeight } from './variant-utils'
import { windStandardMaterial } from './wind-node'

export function waterFeaturesVariantKey(preset: WaterFeaturesPreset, seed: number, waterColor: string): string {
  return `${preset}:${seed}:${waterColor}`
}

const variantCache = new Map<string, VariantData>()

/** Cached procedural waterFeatures geometry for a (preset, seed, waterColor). One
 * generation per variant is shared across every instance — a whole lawn of the
 * same feature is a single InstancedMesh. */
export function getWaterFeaturesVariant(node: WaterFeaturesNode): VariantData {
  const key = waterFeaturesVariantKey(node.preset, node.seed, node.waterColor)
  const cached = variantCache.get(key)
  if (cached) return cached
  const group = buildWaterFeatures(node.preset, node.seed, node.waterColor)
  const subMeshes: SubMesh[] = group.children
    .filter((c): c is Mesh => (c as Mesh).isMesh)
    .map((mesh) => ({ geometry: mesh.geometry, material: mesh.material }))
  const data: VariantData = { subMeshes, naturalHeight: naturalHeight(group) }
  variantCache.set(key, data)
  return data
}

/** A feature of flattened, leaning blades merged into one geometry (one draw per
 * instance). Deterministic in `seed` so the same variant renders identically. */
function buildWaterFeatures(preset: WaterFeaturesPreset, seed: number, waterColor: string): Group {
  const spec = WATER_FEATURE_PRESETS[preset] ?? WATER_FEATURE_PRESETS.fountain
  const rng = mulberry32(seed >>> 0)
  const group = new Group()
  const mat = windStandardMaterial({ color: waterColor, roughness: 0.9, side: DoubleSide })
  const h = spec.defaultHeight

  const blades: BufferGeometry[] = []
  for (let i = 0; i < spec.blades; i++) {
    const bh = h * (0.6 + rng() * 0.6)
    const blade = new ConeGeometry(0.02, bh, 3)
    blade.scale(1, 1, 0.3) // flatten the cone into a blade
    blade.translate(0, bh / 2, 0)
    blade.rotateZ((rng() - 0.5) * 0.7) // lean
    const angle = rng() * Math.PI * 2
    blade.rotateY(angle)
    const r = rng() * 0.07
    blade.translate(Math.cos(angle) * r, 0, Math.sin(angle) * r)
    blades.push(blade)
  }
  group.add(new Mesh(mergeGeometries(blades, false) ?? blades[0], mat))
  return group
}
