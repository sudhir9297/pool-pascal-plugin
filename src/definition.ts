import type { HandleDescriptor, NodeDefinition } from '@pascal-app/core'
import { buildPoolFloorplan, poolTrunkRadius } from './floorplan'
import { poolParametrics } from './parametrics'
import { PoolNode } from './schema'

type PoolDefinition = NodeDefinition<typeof PoolNode> & Record<string, unknown>

const ROTATE_RING_OFFSET = 0.35
  /** Ring hugs the ground like the item gizmo — high enough to clear the water features,
 * low enough to read as a floor affordance. */
const ROTATE_RING_Y = 0.25

/** Whole-pool Y-rotation gizmo: a ring around the pool near the ground. */
function poolRotateHandle(): HandleDescriptor<PoolNode> {
  const ringRadius = (n: PoolNode) => poolTrunkRadius(n) + ROTATE_RING_OFFSET
  const ringY = () => ROTATE_RING_Y
  return {
    kind: 'arc-resize',
    axis: 'angular',
    shape: 'rotate',
    apply: (initial, delta) => {
      const r = initial.rotation ?? [0, 0, 0]
      // Negate to match three.js Y-rotation handedness (same as shelf).
      return { rotation: [r[0], (r[1] ?? 0) - delta, r[2]] as [number, number, number] }
    },
    placement: {
      position: (n) => {
        const r = ringRadius(n)
        return [r * Math.SQRT1_2, ringY(), r * Math.SQRT1_2]
      },
      rotationY: () => -Math.PI / 4,
    },
    decoration: {
      kind: 'ring',
      radius: ringRadius,
      y: ringY,
    },
  }
}

const poolFloorPlacement = {
  footprint: (node: unknown) => {
    const pool = node as PoolNode
    const radius = poolTrunkRadius(pool)
    return {
      dimensions: [radius * 2, pool.height, radius * 2] as [number, number, number],
      rotation: pool.rotation,
    }
  },
  collides: false,
}

/**
 * The pool node definition. Rendering uses the instanced path rather than the
 * per-node `def.geometry`: a collective `def.system` batches every pool into
 * `InstancedMesh`es (collection-scale draw calls), while a featherweight
 * `def.renderer` mounts an invisible per-node proxy so the host's selection /
 * outline / zone machinery works unchanged. `parametrics` gives the inspector
 * for free; `tool`/`preview` drive placement. No host dispatch code per kind.
 */
export const poolDefinition: PoolDefinition = {
  kind: 'pools:pool',
  // Static in the bake for portability; our viewer removes the baked meshes and
  // re-renders live (wind, LODs) via this def's own path. See plans → Part D.
  bake: 'replace',
  schemaVersion: 1,
  schema: PoolNode,
  category: 'furnish',
  snapProfile: 'item',

  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    preset: 'family',
    size: 'medium',
    waterProfile: 'chlorinated',
    height: 7,
    seed: 1,
    detailDensity: 1,
    wallThickness: 1,
    minimal: false,
    waterColor: '#ffffff',
    copingColor: '#ffffff',
  }),

  capabilities: {
    movable: { axes: ['x', 'z'], gridSnap: true },
    rotatable: {
      axes: ['y'],
      snapAngles: Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4),
    },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
    // The auto-measured drag box would wrap the whole water surface (the proxy shows
    // the real geometry while selected) — declare coping-sized bounds instead.
    dragBounds: (node) => {
      const pool = node as unknown as PoolNode
      const radius = poolTrunkRadius(pool)
      return { size: [radius * 2, pool.height ?? 7, radius * 2] }
    },
    // Defined outside the contextually typed object so the optional `collides`
    // hint remains compatible with Pascal hosts released before that field.
    floorPlaced: poolFloorPlacement,
  },

  parametrics: poolParametrics,
  // 2D plan symbol: dashed water ring + coping dot (see floorplan.ts).
  floorplan: buildPoolFloorplan,
  handles: [poolRotateHandle()],

  // Instanced rendering: an invisible per-node proxy for selection/outline...
  renderer: { kind: 'parametric', module: () => import('./proxy-renderer') },
  // ...and a collective system that batches every pool into InstancedMeshes.
  system: { module: () => import('./system'), priority: 3 },
  // Baked `/viewer` re-render for `bake: 'replace'` — collective, instanced.
  bakeReplaceRenderer: { module: () => import('./static-renderer') },

  preview: () => import('./preview'),
  tool: () => import('./tool'),
  toolHints: [
    { key: 'Left click', label: 'Feature pool' },
    { key: 'Esc', label: 'Stop' },
  ],

  presentation: {
    label: 'Pool',
    description: 'A procedural swimming pool. Lap, family, infinity, plunge, courtyard, or spa.',
    icon: { kind: 'iconify', name: 'lucide:pools' },
    paletteSection: 'furnish',
    hidden: true,
  },

  mcp: {
    description:
      'A procedural swimming pool with lap, family, infinity, plunge, courtyard, and spa designs, adjustable dimensions, water profile, surround detail, tint, and deterministic variation.',
  },
}
