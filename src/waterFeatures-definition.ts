import type { NodeDefinition } from '@pascal-app/core'
import { buildWaterFeaturesFloorplan } from './floorplan'
import { waterFeaturesParametrics } from './waterFeatures-parametrics'
import { WaterFeaturesNode } from './waterFeatures-schema'

type WaterFeaturesDefinition = NodeDefinition<typeof WaterFeaturesNode> & Record<string, unknown>

const waterFeaturesFloorPlacement = {
  footprint: (node: unknown) => {
    const waterFeatures = node as WaterFeaturesNode
    const radius = Math.max(0.1, waterFeatures.height * 0.3)
    return {
      dimensions: [radius * 2, waterFeatures.height, radius * 2] as [number, number, number],
      rotation: waterFeatures.rotation,
    }
  },
  collides: false,
}

/**
 * The waterFeatures node definition — a third instanced kind alongside pools & hotTubs.
 * Same composition: a `def.system` batches every feature into InstancedMeshes, a
 * featherweight `def.renderer` proxy keeps selection working, `parametrics`
 * gives the inspector, `tool`/`preview` drive placement.
 */
export const waterFeaturesDefinition: WaterFeaturesDefinition = {
  kind: 'pools:waterFeatures',
  bake: 'replace', // static in bake, live-rebuilt in our viewer — see plans → Part D
  schemaVersion: 1,
  schema: WaterFeaturesNode,
  category: 'furnish',
  snapProfile: 'item',

  defaults: () => ({
    object: 'node',
    parentId: null,
    visible: true,
    metadata: {},
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    preset: 'fountain',
    height: 0.4,
    seed: 1,
    waterColor: '#5a8f3c',
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
    floorPlaced: waterFeaturesFloorPlacement,
  },

  parametrics: waterFeaturesParametrics,
  floorplan: buildWaterFeaturesFloorplan,

  renderer: { kind: 'parametric', module: () => import('./waterFeatures-proxy-renderer') },
  system: { module: () => import('./waterFeatures-system'), priority: 3 },
  bakeReplaceRenderer: { module: () => import('./waterFeatures-static-renderer') },

  preview: () => import('./waterFeatures-preview'),
  tool: () => import('./waterFeatures-tool'),
  toolHints: [
    { key: 'Left click', label: 'Feature waterFeatures' },
    { key: 'Esc', label: 'Stop' },
  ],

  presentation: {
    label: 'WaterFeatures',
    description: 'A procedural water feature. Fountain, spillway, or cascade.',
    icon: { kind: 'iconify', name: 'lucide:wheat' },
    paletteSection: 'furnish',
    hidden: true,
  },

  mcp: {
    description:
      'A procedural water feature node with fountain, spillway, and cascade designs.',
  },
}
