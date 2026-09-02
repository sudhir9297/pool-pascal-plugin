import type { FloorplanGeometry, GeometryContext } from '@pascal-app/core'
import { hotTubWaterColor } from './hotTub-geometry'
import { HOT_TUB_PRESETS } from './hotTub-presets'
import type { HotTubNode } from './hotTub-schema'
import { WATER_FEATURE_PRESETS } from './waterFeatures-presets'
import type { WaterFeaturesNode } from './waterFeatures-schema'
import { POOL_PRESETS } from './presets'
import type { PoolNode } from './schema'

/**
 * 2D plan builders for the feature kinds (`def.floorplan`) — the registry
 * floor-plan layer renders any kind that provides one, so this is all it takes
 * for plugin nodes to appear in the 2D view. Classic architect symbols:
 * a dashed water surface circle (dashed = overhead element, like a roof overhang)
 * with a solid coping dot for pools; small colour dots for hotTubs/waterFeatures.
 */

/** Trunk radius in plan — also the selection footprint, so the move box hugs
 * the coping instead of the whole water surface. */
export function poolTrunkRadius(pool: PoolNode): number {
  return Math.max(0.15, (pool.height ?? 7) * 0.025 * (pool.wallThickness ?? 1))
}

/** Approximate water surface radius in plan (matches the old whole-pool footprint). */
export function poolCanopyRadius(pool: PoolNode): number {
  return Math.max(0.5, (pool.height ?? 7) * 0.28)
}

type ViewChrome = { stroke: string | null; selected: boolean }

/** Selection/hover stroke override shared by the three builders. */
function chromeOf(ctx: GeometryContext): ViewChrome {
  const view = ctx.viewState
  const palette = view?.palette
  if ((view?.selected || view?.highlighted) && palette)
    return { stroke: palette.selectedStroke, selected: view?.selected ?? false }
  if (view?.hovered && palette) return { stroke: palette.wallHoverStroke, selected: false }
  return { stroke: null, selected: false }
}

export function buildPoolFloorplan(node: PoolNode, ctx: GeometryContext): FloorplanGeometry {
  const [x, , z] = node.position ?? [0, 0, 0]
  const swatch = (POOL_PRESETS[node.preset] ?? POOL_PRESETS.family).swatch
  const chrome = chromeOf(ctx)
  const stroke = chrome.stroke ?? swatch

  const children: FloorplanGeometry[] = [
    // Canopy ring — pointer-events on the stroke only, so the (large) disc
    // doesn't steal clicks from whatever sits under the water surface in plan.
    {
      kind: 'circle',
      cx: x,
      cy: z,
      r: poolCanopyRadius(node),
      stroke,
      strokeWidth: 0.03,
      strokeDasharray: '0.18 0.12',
      fill: swatch,
      fillOpacity: 0.06,
      pointerEvents: 'stroke',
    },
    // Trunk dot — the solid, always-clickable core of the symbol.
    {
      kind: 'circle',
      cx: x,
      cy: z,
      r: poolTrunkRadius(node),
      fill: chrome.stroke ?? '#6b4f2e',
      stroke,
      strokeWidth: 0.02,
      opacity: 0.95,
    },
  ]
  if (chrome.selected) children.push({ kind: 'move-handle', point: [x, z] })
  return { kind: 'group', children }
}

export function buildHotTubFloorplan(node: HotTubNode, ctx: GeometryContext): FloorplanGeometry {
  const [x, , z] = node.position ?? [0, 0, 0]
  const preset = HOT_TUB_PRESETS[node.preset] ?? HOT_TUB_PRESETS.spa
  const chrome = chromeOf(ctx)
  const children: FloorplanGeometry[] = [
    {
      kind: 'circle',
      cx: x,
      cy: z,
      r: 0.1,
      fill: hotTubWaterColor(node),
      stroke: chrome.stroke ?? preset.tileColor,
      strokeWidth: 0.02,
    },
    {
      kind: 'circle',
      cx: x,
      cy: z,
      r: 0.035,
      fill: preset.accentColor,
      pointerEvents: 'none',
    },
  ]
  if (chrome.selected) children.push({ kind: 'move-handle', point: [x, z] })
  return { kind: 'group', children }
}

export function buildWaterFeaturesFloorplan(node: WaterFeaturesNode, ctx: GeometryContext): FloorplanGeometry {
  const [x, , z] = node.position ?? [0, 0, 0]
  const preset = WATER_FEATURE_PRESETS[node.preset] ?? WATER_FEATURE_PRESETS.fountain
  const water = node.waterColor ?? preset.waterColor
  const chrome = chromeOf(ctx)
  const children: FloorplanGeometry[] = [
    {
      kind: 'circle',
      cx: x,
      cy: z,
      r: 0.12,
      fill: water,
      fillOpacity: 0.5,
      stroke: chrome.stroke ?? water,
      strokeWidth: 0.02,
      strokeDasharray: '0.06 0.05',
    },
  ]
  if (chrome.selected) children.push({ kind: 'move-handle', point: [x, z] })
  return { kind: 'group', children }
}
