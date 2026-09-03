import type { FloorplanGeometry, HandleDescriptor, NodeDefinition } from '@pascal-app/core'
import { getPoolDepthRange } from '../design/depth-profile'
import { poolParametrics } from '../editor/parametrics'
import { PoolNode, resolvePoolPolygon } from './schema'
import { createPoolShapePolygon, getPoolPolygonDimensions, isDrawnPoolShape } from '../design/shapes'
import { WATER_PRESET_SETTINGS } from '../shader/water-presets'

type PoolDefinition = NodeDefinition<typeof PoolNode> & Record<string, unknown>

const SIDE_HANDLE_OFFSET = 0.35
const HANDLE_HEIGHT_OFFSET = 0.18
const DEPTH_HANDLE_FLOOR_CLEARANCE = 0.25
const MIN_POOL_DIMENSION = 0.5
const MAX_POOL_DIMENSION = 100
const MAX_POOL_DEPTH = 4

function finiteOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function poolHandleDeckElevation(node: PoolNode) {
  return finiteOr(node.finishedDeckElevation, 0)
}

function poolHandleCopingThickness(node: PoolNode) {
  return finiteOr(node.copingThickness, 0.08)
}

function poolHandleCopingWidth(node: PoolNode) {
  return finiteOr(node.copingWidth, 0.3)
}

function resizePoolOutline(
  node: PoolNode,
  length: number,
  width: number,
): Pick<PoolNode, 'outlineControlPoints' | 'polygon'> {
  if (!isDrawnPoolShape(node.shape)) {
    return {
      outlineControlPoints: [],
      polygon: createPoolShapePolygon(node.shape, length, width),
    }
  }

  const polygon = resolvePoolPolygon(node)
  const xs = polygon.map(([x]) => x)
  const zs = polygon.map(([, z]) => z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  const scaleX = length / Math.max(maxX - minX, Number.EPSILON)
  const scaleZ = width / Math.max(maxZ - minZ, Number.EPSILON)
  const scale = (points: ReadonlyArray<readonly [number, number]>) => points.map(
    ([x, z]): [number, number] => [
      centerX + (x - centerX) * scaleX,
      centerZ + (z - centerZ) * scaleZ,
    ],
  )
  return {
    outlineControlPoints: scale(node.outlineControlPoints),
    polygon: scale(polygon),
  }
}

function poolHorizontalHandle(axis: 'x' | 'z'): HandleDescriptor<PoolNode> {
  return {
    kind: 'linear-resize',
    axis,
    anchor: 'center',
    gridSnap: true,
    min: MIN_POOL_DIMENSION,
    max: MAX_POOL_DIMENSION,
    currentValue: (node) => {
      const dimensions = isDrawnPoolShape(node.shape)
        ? getPoolPolygonDimensions(resolvePoolPolygon(node))
        : node
      return axis === 'x' ? dimensions.length : dimensions.width
    },
    apply: (node, newValue) => {
      const dimensions = isDrawnPoolShape(node.shape)
        ? getPoolPolygonDimensions(resolvePoolPolygon(node))
        : node
      const length = axis === 'x' ? newValue : dimensions.length
      const width = axis === 'z' ? newValue : dimensions.width
      return {
        length,
        width,
        ...resizePoolOutline(node, length, width),
      }
    },
    placement: {
      position: (node) => {
        const dimensions = isDrawnPoolShape(node.shape)
          ? getPoolPolygonDimensions(resolvePoolPolygon(node))
          : node
        return axis === 'x'
          ? [
              dimensions.length / 2 + poolHandleCopingWidth(node) + SIDE_HANDLE_OFFSET,
              poolHandleDeckElevation(node)
                + poolHandleCopingThickness(node)
                + HANDLE_HEIGHT_OFFSET,
              0,
            ]
          : [
              0,
              poolHandleDeckElevation(node)
                + poolHandleCopingThickness(node)
                + HANDLE_HEIGHT_OFFSET,
              dimensions.width / 2 + poolHandleCopingWidth(node) + SIDE_HANDLE_OFFSET,
            ]
      },
    },
  }
}

function poolDepthHandle(): HandleDescriptor<PoolNode> {
  return {
    kind: 'linear-resize',
    axis: 'y',
    // The deck is fixed while the basin floor follows a downward drag.
    anchor: 'max',
    min: MIN_POOL_DIMENSION,
    max: MAX_POOL_DEPTH,
    currentValue: (node) => getPoolDepthRange(node).maximum,
    apply: (node, newValue) => node.floorProfile === 'flat'
      ? { depth: newValue }
      : {
          deepDepth: newValue,
          shallowDepth: Math.min(node.shallowDepth, newValue),
        },
    placement: {
      position: (node) => [
        0,
        poolHandleDeckElevation(node)
          - getPoolDepthRange(node).maximum
          + DEPTH_HANDLE_FLOOR_CLEARANCE,
        0,
      ],
    },
  }
}

function poolHandles(): HandleDescriptor<PoolNode>[] {
  return [poolHorizontalHandle('x'), poolHorizontalHandle('z'), poolDepthHandle()]
}

export const DEFAULT_POOL = {
  shape: 'rectangle' as const,
  length: 8,
  width: 4,
  polygon: [[-4, -2], [4, -2], [4, 2], [-4, 2]] as Array<[number, number]>,
  outlineControlPoints: [] as Array<[number, number]>,
  children: [] as string[],
  floorProfile: 'flat' as const,
  depth: 1.5,
  shallowDepth: 1.1,
  deepDepth: 2,
  slopeStart: 35,
  slopeEnd: 70,
  coveRadius: 0.15,
  entryFeature: 'none' as const,
  entryLength: 2,
  entryWaterDepth: 0.25,
  stepCount: 3,
  benchEnabled: false,
  benchStyle: 'end' as const,
  benchWidth: 0.5,
  benchWaterDepth: 0.5,
  copingWidth: 0.3,
  copingThickness: 0.08,
  copingStyle: 'continuous' as const,
  copingStoneLength: 0.65,
  copingJointWidth: 0.025,
  copingIrregularity: 0.4,
  copingSeed: 1847,
  shellThickness: 0.2,
  floorThickness: 0.2,
  openingClearance: 0.02,
  finishedDeckElevation: 0,
  designWaterElevation: -0.12,
  copingProfile: 'square' as const,
  copingCorner: 'miter' as const,
  copingColor: '#e2e8f0',
  ...WATER_PRESET_SETTINGS['crystal-clear'],
  sunElevation: 52,
  sunAzimuth: 135,
  supportSlabId: null,
  waterColor: '#38bdf8',
  shellColor: '#e2e8f0',
  interiorFinish: 'light-mosaic' as const,
  visualPreset: 'custom' as const,
} as const

export function poolFloorplan(node: PoolNode): FloorplanGeometry {
  const [first, ...rest] = resolvePoolPolygon(node)
  const basin: FloorplanGeometry = {
    kind: 'path',
    d: first
      ? `M ${first[0]} ${first[1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(' ')} Z`
      : '',
    fill: node.waterColor,
    fillOpacity: 0.55,
    stroke: node.copingColor,
    strokeWidth: Math.min(node.copingWidth, 0.25),
  }
  return basin
}

export const poolDefinition: PoolDefinition = {
  kind: 'pool:pool',
  schemaVersion: 23,
  schema: PoolNode,
  category: 'furnish',
  snapProfile: 'item',
  defaults: () => ({
    object: 'node', parentId: null, visible: true, metadata: {},
    position: [0, 0, 0], rotation: [0, 0, 0], ...DEFAULT_POOL,
  }),
  capabilities: {
    movable: { axes: ['x', 'z'], gridSnap: true },
    rotatable: { axes: ['y'], snapAngles: Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4) },
    selectable: { hitVolume: 'bbox' },
    duplicable: true,
    deletable: true,
    groupable: true,
    snappable: {},
    floorPlaced: {
      footprint: (value) => {
        const node = value as unknown as PoolNode
        const polygon = resolvePoolPolygon(node)
        const xs = polygon.map(([x]) => x)
        const zs = polygon.map(([, z]) => z)
        return {
          dimensions: [
            Math.max(...xs) - Math.min(...xs) + node.copingWidth * 2,
            getPoolDepthRange(node).maximum,
            Math.max(...zs) - Math.min(...zs) + node.copingWidth * 2,
          ],
          rotation: node.rotation,
        }
      },
    },
  },
  parametrics: poolParametrics,
  handles: poolHandles,
  floorplan: poolFloorplan,
  renderer: { kind: 'parametric', module: () => import('../editor/renderer') },
  system: { module: () => import('../editor/opening-system'), priority: 3 },
  preview: () => import('../editor/preview'),
  tool: () => import('../editor/tool'),
  toolHints: [
    { key: 'Left click / drag', label: 'Place preset, add corner, or sketch freehand' },
    { key: 'Release / Enter', label: 'Finish the drawn pool outline' },
    { key: 'Esc', label: 'Cancel pool drawing' },
  ],
  presentation: {
    label: 'Swimming pool',
    description: 'Place a pool shape preset or sketch a smooth freehand in-ground outline.',
    icon: { kind: 'iconify', name: 'lucide:waves' },
    paletteSection: 'furnish',
    hidden: true,
  },
  mcp: {
    description: 'An in-ground swimming pool with a preset, freehand, or custom outline, editable floor profile, and finishes.',
  },
}
