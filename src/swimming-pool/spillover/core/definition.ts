import type { FloorplanGeometry, GeometryContext, NodeDefinition } from '@pascal-app/core'
import { poolSpilloverParametrics } from '../editor/parametrics'
import { firstPoolHintVisibility, secondPoolHintVisibility } from '../design/stage'
import { PoolSpilloverNode } from './schema'

const poolSpilloverToolHints = [
  { key: 'Click', label: 'Select the first pool', visible: firstPoolHintVisibility },
  { key: 'Click', label: 'Select the second pool', visible: secondPoolHintVisibility },
  { key: 'Move', label: 'Preview the connection', visible: secondPoolHintVisibility },
  { key: 'Esc', label: 'Cancel spillover placement' },
]

export const DEFAULT_POOL_SPILLOVER = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  sourcePoolId: '',
  targetPoolId: '',
  connectionStyle: 'auto' as const,
  connectionMode: 'overlap' as const,
  sourceOpening: [] as Array<[number, number]>,
  targetOpening: [] as Array<[number, number]>,
  sourceEdge: [] as Array<[number, number]>,
  targetEdge: [] as Array<[number, number]>,
  connectionPath: [] as Array<[number, number]>,
  intersection: [] as Array<Array<[number, number]>>,
  sourceSide: 1 as const,
  width: 2,
  effectiveWidth: null as number | null,
  length: 0.8,
  landingInset: 0,
  dropHeight: 0.25,
  lipThickness: 0.08,
  flowStrength: 1,
  waterColor: '#38bdf8',
  surfaceColor: '#e2e8f0',
}

function worldPointToLocal(node: PoolSpilloverNode, point: [number, number]) {
  const angle = node.rotation[1] ?? 0
  const dx = point[0] - node.position[0]
  const dz = point[1] - node.position[2]
  return [
    dx * Math.cos(angle) - dz * Math.sin(angle),
    dx * Math.sin(angle) + dz * Math.cos(angle),
  ] as [number, number]
}

export function poolSpilloverFloorplan(
  node: PoolSpilloverNode,
  ctx?: GeometryContext,
): FloorplanGeometry {
  const source = node.connectionPath[0]
    ? worldPointToLocal(node, node.connectionPath[0])
    : [node.sourceSide * node.length / 2, 0] as [number, number]
  const target = node.connectionPath[1]
    ? worldPointToLocal(node, node.connectionPath[1])
    : [-node.sourceSide * node.length / 2, 0] as [number, number]
  const width = node.effectiveWidth ?? node.width
  const selected = ctx?.viewState?.selected ?? false
  return {
    kind: 'group',
    children: [
      {
        kind: 'line',
        x1: source[0], y1: source[1], x2: target[0], y2: target[1],
        stroke: node.surfaceColor,
        strokeWidth: node.connectionMode === 'channel' ? width + node.lipThickness * 2 : width,
        opacity: 0.7,
        pointerEvents: 'stroke',
      },
      {
        kind: 'line',
        x1: source[0], y1: source[1], x2: target[0], y2: target[1],
        stroke: selected ? (ctx?.viewState?.palette.selectedStroke ?? '#0284c7') : node.waterColor,
        strokeWidth: Math.max(0.08, width - node.lipThickness * 2),
        opacity: 0.9,
        pointerEvents: 'stroke',
      },
    ],
  }
}

export const poolSpilloverDefinition: NodeDefinition<typeof PoolSpilloverNode> = {
  kind: 'pool:spillover',
  schemaVersion: 1,
  schema: PoolSpilloverNode,
  category: 'furnish',
  distributionRole: 'run',
  snapProfile: 'item',
  extensions: {
    'pascal:editor/floorplan': {
      tool: () => import('../editor/floorplan-tool'),
    },
  },
  defaults: () => ({ object: 'node', parentId: null, visible: true, metadata: {}, ...DEFAULT_POOL_SPILLOVER }),
  capabilities: {
    movable: { axes: ['x', 'y', 'z'], gridSnap: true },
    rotatable: { axes: ['y'] },
    selectable: { hitVolume: 'bbox' },
    duplicable: false,
    deletable: true,
    groupable: true,
    snappable: {},
  },
  renderer: { kind: 'parametric', module: () => import('../editor/preview') },
  floorplan: poolSpilloverFloorplan,
  tool: () => import('../editor/tool'),
  toolHints: poolSpilloverToolHints,
  parametrics: poolSpilloverParametrics,
  presentation: {
    label: 'Pool spillover',
    description: 'Directional water flow from a higher swimming pool into a lower pool.',
    icon: { kind: 'iconify', name: 'lucide:move-down' },
    paletteSection: 'furnish',
  },
}
