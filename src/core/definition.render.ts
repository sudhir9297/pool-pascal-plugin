import { poolBasinFloorplan } from '../rendering/basin-floorplan'
import { planPath, poolPlanPoint } from '../rendering/plan-frame'
import { buildPoolOutlines } from '../design/outlines'
import type { FloorplanGeometry, GeometryContext, MovableConfig } from '@pascal-app/core'
import { getPoolDepthRange } from '../design/depth-profile'
import { DEFAULT_POOL, PoolNode, resolvePoolPolygon } from './schema'
import { isDrawnPoolShape } from '../design/shapes'
import { poolOutlineAnchors, poolOutlineMidpoint, poolOutlineTangents } from '../design/outline-edit'
import { poolOutlineInsertIndices, visiblePoolOutlineAnchors } from '../design/outline-control-visibility'
import { usePoolOutlineControls } from '../editor/outline-control-state'
import { bakePoolWaterAnimation } from './export-animation'
import type { PoolRenderDefinition } from '../definition-compose'

const poolMovable: MovableConfig & { preserveLevelAndElevation: boolean } = {
  axes: ['x', 'z'], gridSnap: true, preserveLevelAndElevation: true,
}

export function poolFloorplan(node: PoolNode, ctx?: GeometryContext): FloorplanGeometry {
  // Floorplan geometry is level-local; the host does not apply the node pose.
  const toPlan = (point: readonly [number, number]) => poolPlanPoint(node, point, ctx)
  const selected = ctx?.viewState?.selected ?? false
  const children = poolBasinFloorplan(node, ctx)
  if (!selected) return { kind: 'group', children }
  const outlines = buildPoolOutlines(resolvePoolPolygon(node), node)
  const selectionOutline: FloorplanGeometry = {
    kind: 'path', d: planPath(outlines.copingOuter.map(toPlan)), fill: 'none', stroke: '#475569',
    strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke', pointerEvents: 'none',
  }
  if (!isDrawnPoolShape(node.shape)) return { kind: 'group', children: [...children, selectionOutline] }
  const localAnchors = poolOutlineAnchors(node)
  const anchors = localAnchors.map(toPlan)
  const controls = usePoolOutlineControls.getState()
  const focused = controls.nodeId === node.id ? controls.focusedIndex : null
  const visibleIndices = visiblePoolOutlineAnchors(localAnchors, controls.nodeId === node.id && controls.showAll, focused)
  const insertIndices = poolOutlineInsertIndices(anchors.length, focused)
  const tangents = node.shape === 'spline' ? poolOutlineTangents(node).map((tangent) => ({
    incoming: toPlan(tangent.incoming), outgoing: toPlan(tangent.outgoing),
  })) : []
  return { kind: 'group', children: [...children, selectionOutline,
    ...visibleIndices.map((index): FloorplanGeometry => ({
      kind: 'endpoint-handle', point: anchors[index]!, state: focused === index ? 'active' : 'idle', variant: 'endpoint',
      affordance: 'pool-outline-move', payload: { index },
    })),
    ...insertIndices.map((index): FloorplanGeometry => ({
      kind: 'midpoint-handle', point: toPlan(poolOutlineMidpoint(node, index)),
      affordance: 'pool-outline-insert', payload: { index },
    })),
    ...(focused !== null && tangents[focused] ? [focused] : []).flatMap((index): FloorplanGeometry[] => {
      const tangent = tangents[index]!
      return [
        { kind: 'line', x1: anchors[index]![0], y1: anchors[index]![1],
          x2: tangent.incoming[0], y2: tangent.incoming[1], stroke: '#8381ed',
          strokeWidth: 1.25, vectorEffect: 'non-scaling-stroke' },
        { kind: 'line', x1: anchors[index]![0], y1: anchors[index]![1],
          x2: tangent.outgoing[0], y2: tangent.outgoing[1], stroke: '#8381ed',
          strokeWidth: 1.25, vectorEffect: 'non-scaling-stroke' },
        { kind: 'endpoint-handle', point: tangent.incoming, state: 'idle', variant: 'curve',
          affordance: 'pool-outline-incoming', payload: { index } },
        { kind: 'endpoint-handle', point: tangent.outgoing, state: 'idle', variant: 'curve',
          affordance: 'pool-outline-outgoing', payload: { index } },
      ]
    }),
  ] }
}

/**
 * The pool's render half: schema, defaults, capabilities, the read-only
 * renderer and opening system, the plan and the baked water animation.
 */
export const poolRenderDefinition: PoolRenderDefinition<typeof PoolNode> & Record<string, unknown> = {
  kind: 'pool:pool',
  schemaVersion: 26,
  schema: PoolNode,
  category: 'furnish',
  relations: { hosts: ['pool:skimmer', 'pool:inlet', 'pool:drain', 'pool:stair', 'pool:waterfall'], cascadeDelete: 'descendants' },
  defaults: () => ({
    object: 'node', parentId: null, visible: true, metadata: {},
    position: [0, 0, 0], rotation: [0, 0, 0], ...DEFAULT_POOL,
  }),
  capabilities: {
    movable: poolMovable,
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
  floorplan: poolFloorplan,
  renderer: { kind: 'parametric', module: () => import('../editor/renderer') },
  exportAnimation: ({ node, object }) => bakePoolWaterAnimation(node, object),
  system: { module: () => import('../editor/opening-system'), priority: 3 },
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
