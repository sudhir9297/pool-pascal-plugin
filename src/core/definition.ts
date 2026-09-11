import type { FloorplanGeometry, GeometryContext, HandleDescriptor, NodeDefinition } from '@pascal-app/core'
import { Euler, Vector3 } from 'three'
import { getPoolDepthRange } from '../design/depth-profile'
import { poolParametrics } from '../editor/parametrics'
import { DEFAULT_POOL, PoolNode, resolvePoolPolygon } from './schema'
import { createPoolShapePolygon, getPoolPolygonDimensions, isDrawnPoolShape } from '../design/shapes'

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
    anchor: 'min',
    gridSnap: true,
    min: MIN_POOL_DIMENSION,
    max: MAX_POOL_DIMENSION,
    currentValue: (node) => {
      const dimensions = isDrawnPoolShape(node.shape)
        ? getPoolPolygonDimensions(resolvePoolPolygon(node))
        : node
      return axis === 'x' || node.shape === 'circle' ? dimensions.length : dimensions.width
    },
    apply: (node, newValue) => {
      const dimensions = isDrawnPoolShape(node.shape)
        ? getPoolPolygonDimensions(resolvePoolPolygon(node))
        : node
      const length = axis === 'x' || node.shape === 'circle' ? newValue : dimensions.length
      const width = node.shape === 'circle' ? newValue : axis === 'z' ? newValue : dimensions.width
      // Outlines resize around their local centre. Move that centre by half
      // the size change so the opposite edge stays fixed in the parent frame.
      const offset = new Vector3(
        axis === 'x' ? (length - dimensions.length) / 2 : 0,
        0,
        axis === 'z' ? (width - (node.shape === 'circle' ? dimensions.length : dimensions.width)) / 2 : 0,
      ).applyEuler(new Euler(...node.rotation))
      return {
        length,
        width,
        position: new Vector3(...node.position).add(offset).toArray(),
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
              (node.shape === 'circle' ? dimensions.length : dimensions.width) / 2 + poolHandleCopingWidth(node) + SIDE_HANDLE_OFFSET,
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

export function poolFloorplan(node: PoolNode, ctx?: GeometryContext): FloorplanGeometry {
  const [first, ...rest] = resolvePoolPolygon(node)
  const selected = ctx?.viewState?.selected ?? false
  const outlineWidth = Math.min(node.copingWidth, 0.25)
  const basin: FloorplanGeometry = {
    kind: 'path',
    d: first
      ? `M ${first[0]} ${first[1]} ${rest.map(([x, y]) => `L ${x} ${y}`).join(' ')} Z`
      : '',
    fill: node.waterColor,
    fillOpacity: selected ? 0.72 : 0.55,
    stroke: selected ? (ctx?.viewState?.palette.selectedStroke ?? '#22c55e') : node.copingColor,
    strokeWidth: selected ? Math.max(0.12, outlineWidth * 1.5) : outlineWidth,
  }
  return basin
}

export const poolDefinition: PoolDefinition = {
  kind: 'pool:pool',
  schemaVersion: 24,
  schema: PoolNode,
  category: 'furnish',
  snapProfile: 'item',
  relations: { hosts: ['pool:skimmer', 'pool:inlet', 'pool:drain', 'pool:stair', 'pool:waterfall'], cascadeDelete: 'descendants' },
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
