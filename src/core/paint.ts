import { getMaterialPresetByRef, parseMaterialRef, resolveMaterial, useScene, type MaterialSchema, type SceneMaterialId, type PaintCapability } from '@pascal-app/core'
import { Color, Mesh, type Material, type Object3D } from 'three'

type PaintedNode = { metadata?: Record<string, unknown> }
export function resolvePoolPaintColor(material?: MaterialSchema, materialPreset?: string): string | null {
  if (materialPreset) {
    const ref = parseMaterialRef(materialPreset)
    if (ref?.kind === 'scene') {
      const saved = useScene.getState().materials[ref.id as SceneMaterialId]
      return saved ? resolveMaterial(saved.material).color : null
    }
    return getMaterialPresetByRef(materialPreset)?.mapProperties.color ?? null
  }
  return material ? resolveMaterial(material).color : null
}
export function poolColors(node: PaintedNode): Record<string, string> {
  const value = node.metadata?.poolColors
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}

function roleOf(object: Object3D): string | null {
  let current: Object3D | null = object
  while (current) {
    if (current.name === 'pool-water' || /water-sheet|receiving-water|flow-lines|bubble|splash/i.test(current.name)) return null
    if (current.name === 'pool-coping' || current.name.startsWith('pool-coping-stone')) return 'border'
    if (current.name.startsWith('pool-shell') || current.name.startsWith('pool-entry') || current.name === 'pool-bench') return 'shell'
    if (current.userData.poolPaintOwner) break
    current = current.parent
  }
  return 'body'
}

function colorable(material: Material): material is Material & { color: Color } {
  return 'color' in material && material.color instanceof Color && !material.transparent
}

export function applyPoolColors(root: Object3D, colors: Record<string, string>): () => void {
  const restore: Array<() => void> = []
  const visit = (object: Object3D) => {
    if (object !== root && object.userData.poolPaintOwner) return
    if (object instanceof Mesh) {
      const role = roleOf(object)
      const color = role && colors[role]
      if (color) {
        const original = object.material
        const clones: Material[] = []
        const paint = (material: Material) => {
          if (!colorable(material)) return material
          const copy = material.clone() as Material & { color: Color }
          copy.color.set(color)
          clones.push(copy)
          return copy
        }
        object.material = Array.isArray(original) ? original.map(paint) : paint(original)
        restore.push(() => { object.material = original; clones.forEach(material => material.dispose()) })
      }
    }
    object.children.forEach(visit)
  }
  visit(root)
  return () => restore.forEach(cleanup => cleanup())
}

export const poolPaint: PaintCapability = {
  resolveRole: ({ hitObject }) => {
    if (!(hitObject instanceof Mesh)) return null
    const materials = Array.isArray(hitObject.material) ? hitObject.material : [hitObject.material]
    return materials.some(colorable) ? roleOf(hitObject) : null
  },
  buildPatch: ({ node, role, material, materialPreset }) => {
    const color = resolvePoolPaintColor(material, materialPreset)
    return color ? { metadata: { ...node.metadata, poolColors: { ...poolColors(node), [role]: color } } } : {}
  },
  applyPreview: ({ root, role, material, materialPreset }) => {
    const color = resolvePoolPaintColor(material, materialPreset)
    return color ? applyPoolColors(root, { [role]: color }) : null
  },
  getEffectiveMaterial: ({ node, role }) => {
    const color = poolColors(node)[role]
    return color ? { material: { preset: 'custom', properties: { ...resolveMaterial(), color } }, materialPreset: undefined } : null
  },
}
