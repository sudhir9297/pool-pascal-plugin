import type { NodeDefinition } from '@pascal-app/core'
import { buildHotTubFloorplan } from './floorplan'
import { hotTubParametrics } from './hotTub-parametrics'
import { HotTubNode } from './hotTub-schema'

type HotTubDefinition = NodeDefinition<typeof HotTubNode> & Record<string, unknown>

const hotTubFloorPlacement = {
  footprint: (node: unknown) => {
    const hotTub = node as HotTubNode
    const radius = Math.max(0.1, hotTub.height * 0.25)
    return {
      dimensions: [radius * 2, hotTub.height, radius * 2] as [number, number, number],
      rotation: hotTub.rotation,
    }
  },
  collides: false,
}

/**
 * The hotTub node definition — a sibling instanced kind to the pool. Same
 * composition: a `def.system` batches every hotTub into InstancedMeshes, a
 * featherweight `def.renderer` proxy keeps selection working, `parametrics`
 * gives the inspector, `tool`/`preview` drive placement.
 */
export const hotTubDefinition: HotTubDefinition = {
  kind: 'pools:hotTub',
  bake: 'replace', // static in bake, live-rebuilt in our viewer — see plans → Part D
  schemaVersion: 1,
  schema: HotTubNode,
  category: 'furnish',
  snapProfile: 'item',

  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    preset: 'spa',
    height: 0.5,
    seed: 1,
    waterColor: '#fcfcf2',
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
    floorPlaced: hotTubFloorPlacement,
  },

  parametrics: hotTubParametrics,
  floorplan: buildHotTubFloorplan,

  renderer: { kind: 'parametric', module: () => import('./hotTub-proxy-renderer') },
  system: { module: () => import('./hotTub-system'), priority: 3 },
  bakeReplaceRenderer: { module: () => import('./hotTub-static-renderer') },

  preview: () => import('./hotTub-preview'),
  tool: () => import('./hotTub-tool'),
  toolHints: [
    { key: 'Left click', label: 'Feature hotTub' },
    { key: 'Esc', label: 'Stop' },
  ],

  presentation: {
    label: 'HotTub',
    description: 'A procedural spa. Spa, therapy pool, or plunge spa.',
    icon: { kind: 'iconify', name: 'lucide:hotTub-2' },
    paletteSection: 'furnish',
    hidden: true,
  },

  mcp: {
    description:
      'A procedural spa node with spa, therapy pool, and plunge spa designs.',
  },
}
