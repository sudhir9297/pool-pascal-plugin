import type { AnyNode } from '@pascal-app/core'
import { ShapeUtils, Vector2 } from 'three'
import { PoolNode, resolvePoolPolygon, type PoolPoint } from '../core/schema'
import { PoolSpilloverNode } from '../spillover/core/schema'
import { buildPoolOutlines, outsetPoolPolygon } from './outlines'
import { getPoolDepthResolver } from './depth-profile'
import { getPoolIntersectionRegions } from './shared-joint'

function polygonArea(points: PoolPoint[]) {
  return Math.abs(points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]!
    return area + point[0] * next[1] - next[0] * point[1]
  }, 0) / 2)
}

function convexHull(points: PoolPoint[]): PoolPoint[] {
  const unique = Array.from(new Map(points.map(point => [`${point[0].toFixed(8)}:${point[1].toFixed(8)}`, point])).values())
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (unique.length < 3) return unique
  const cross = (o: PoolPoint, a: PoolPoint, b: PoolPoint) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (ordered: PoolPoint[]) => {
    const result: PoolPoint[] = []
    for (const point of ordered) {
      while (result.length >= 2 && cross(result[result.length - 2]!, result[result.length - 1]!, point) <= 1e-8) result.pop()
      result.push(point)
    }
    return result
  }
  return half(unique).slice(0, -1).concat(half([...unique].reverse()).slice(0, -1))
}

function mergeConvexIntersection(regions: PoolPoint[][]) {
  const hull = convexHull(regions.flat())
  const regionArea = regions.reduce((sum, region) => sum + polygonArea(region), 0)
  const hullArea = polygonArea(hull)
  return hull.length >= 3 && Math.abs(hullArea - regionArea) <= Math.max(1e-5, regionArea * 1e-5)
    ? [hull]
    : regions
}

function hasCollinearBoundaryOverlap(first: PoolPoint[], second: PoolPoint[]) {
  const epsilon = 1e-6
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const a = first[firstIndex]!
    const b = first[(firstIndex + 1) % first.length]!
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const lengthSquared = dx * dx + dz * dz
    if (lengthSquared <= epsilon * epsilon) continue
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const c = second[secondIndex]!
      const d = second[(secondIndex + 1) % second.length]!
      const otherDx = d[0] - c[0]
      const otherDz = d[1] - c[1]
      if (Math.abs(dx * otherDz - dz * otherDx) > epsilon * Math.sqrt(lengthSquared)) continue
      if (Math.abs(dx * (c[1] - a[1]) - dz * (c[0] - a[0])) > epsilon * Math.sqrt(lengthSquared)) continue
      const start = ((c[0] - a[0]) * dx + (c[1] - a[1]) * dz) / lengthSquared
      const end = ((d[0] - a[0]) * dx + (d[1] - a[1]) * dz) / lengthSquared
      if (Math.min(1, Math.max(start, end)) - Math.max(0, Math.min(start, end)) > epsilon) return true
    }
  }
  return false
}

/** Portions of this border retained inside the neighbouring border's cutter.
 * As with editor wall joins, both borders meet on the line from the basin
 * crossing to the intersection of their outer offset edges.
 */
function buildCopingMiterKeeps(first: PoolPoint[], firstOuter: PoolPoint[], second: PoolPoint[], secondOuter: PoolPoint[]) {
  const cross = (a: PoolPoint, b: PoolPoint) => a[0] * b[1] - a[1] * b[0]
  const sub = (a: PoolPoint, b: PoolPoint): PoolPoint => [a[0] - b[0], a[1] - b[1]]
  const lineHit = (a: PoolPoint, b: PoolPoint, c: PoolPoint, d: PoolPoint) => {
    const u = sub(b, a), v = sub(d, c)
    const denominator = cross(u, v)
    if (Math.abs(denominator) < 1e-9) return null
    const t = cross(sub(c, a), v) / denominator
    const s = cross(sub(c, a), u) / denominator
    return { point: [a[0] + u[0] * t, a[1] + u[1] * t] as PoolPoint, t, s }
  }
  const keeps: PoolPoint[][] = []
  for (let i = 0; i < first.length; i++) {
    const j = (i + 1) % first.length
    for (let k = 0; k < second.length; k++) {
      const l = (k + 1) % second.length
      const crossing = lineHit(first[i]!, first[j]!, second[k]!, second[l]!)
      if (!crossing || crossing.t < -1e-7 || crossing.t > 1 + 1e-7 || crossing.s < -1e-7 || crossing.s > 1 + 1e-7) continue
      const outer = lineHit(firstOuter[i]!, firstOuter[j]!, secondOuter[k]!, secondOuter[l]!)
      const end = lineHit(first[i]!, first[j]!, secondOuter[k]!, secondOuter[l]!)
      if (!outer || !end) continue
      const p = crossing.point
      const width = Math.max(
        Math.abs(cross(sub(firstOuter[i]!, first[i]!), sub(first[j]!, first[i]!))) / Math.hypot(...sub(first[j]!, first[i]!)),
        Math.abs(cross(sub(secondOuter[k]!, second[k]!), sub(second[l]!, second[k]!))) / Math.hypot(...sub(second[l]!, second[k]!)),
      )
      // Bound nearly parallel miters just as the editor's wall solver does.
      if (Math.hypot(...sub(outer.point, p)) > width * 10) continue
      const triangle = [p, end.point, outer.point]
      if (polygonArea(triangle) > 1e-9) keeps.push(triangle)
    }
  }
  return keeps
}

export type PoolOverlap = {
  footprint: PoolPoint[]
  regions: PoolPoint[][]
  topHeights: number[]
  trimBasin?: boolean
  copingFootprints?: PoolPoint[][]
  copingMiterKeeps?: PoolPoint[][]
  wallRegions?: PoolPoint[][]
  wallCapRegions?: PoolPoint[][]
  suppressSeparator?: boolean
  preserveWater?: boolean
}

/** Only the lower member of an explicit spillover pair yields its footprint. */
export function getPoolOverlaps(pool: PoolNode, nodes: Record<string, AnyNode>): PoolOverlap[] {
  const seen = new Set<string>()
  return Object.values(nodes).flatMap((value) => {
    if (String(value.type) !== 'pool:spillover') return []
    const parsed = PoolSpilloverNode.safeParse(value)
    if (!parsed.success) return []
    const connection = parsed.data
    if (![connection.sourcePoolId, connection.targetPoolId].includes(pool.id)) return []
    const otherId = connection.sourcePoolId === pool.id ? connection.targetPoolId : connection.sourcePoolId
    const parsedOther = PoolNode.safeParse(nodes[otherId])
    if (!parsedOther.success || seen.has(otherId)) return []
    const other = parsedOther.data
    if (other.parentId !== pool.parentId) return []
    const intersectionRegions = getPoolIntersectionRegions(pool, other)
    if (!intersectionRegions.length) return []
    const poolHeight = pool.position[1] + pool.designWaterElevation
    const otherHeight = other.position[1] + other.designWaterElevation
    const rotation = pool.rotation[1] ?? 0
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)
    const localRegions = intersectionRegions.map(region => region.map(([x, z]) => {
      const dx = x - pool.position[0]
      const dz = z - pool.position[2]
      return [dx * cos - dz * sin, dx * sin + dz * cos] as PoolPoint
    }))
    const exactRegions = mergeConvexIntersection(localRegions)
    if (Math.abs(otherHeight - poolHeight) <= 0.001) {
      const ownsSharedSurface = pool.id === connection.sourcePoolId
      // The tiled wall ends at the exact basin intersection. Its horizontal
      // shell caps and coping use the wider coping outline so no internal rim
      // survives. On a collinear exterior run the owner uses a tiny basin
      // inset and keeps the one union boundary needed to close the pool.
      const otherOutlines = buildPoolOutlines(resolvePoolPolygon(other), other)
      const otherCos = Math.cos(other.rotation[1] ?? 0)
      const otherSin = Math.sin(other.rotation[1] ?? 0)
      const toLocal = (outline: PoolPoint[]) => outline.map(([x, z]): PoolPoint => {
        const worldX = other.position[0] + x * otherCos + z * otherSin
        const worldZ = other.position[2] - x * otherSin + z * otherCos
        const dx = worldX - pool.position[0]
        const dz = worldZ - pool.position[2]
        return [dx * cos - dz * sin, dx * sin + dz * cos]
      })
      const otherBasin = toLocal(otherOutlines.basin)
      const otherBasinInset = toLocal(outsetPoolPolygon(otherOutlines.basin, -0.002))
      const otherCopingOuter = toLocal(otherOutlines.copingOuter)
      const currentOutlines = buildPoolOutlines(resolvePoolPolygon(pool), pool)
      const sharesBoundary = hasCollinearBoundaryOverlap(currentOutlines.basin, otherBasin)
      const wallRegions = [ownsSharedSurface && sharesBoundary ? otherBasinInset : otherBasin]
      const wallCapRegions = [ownsSharedSurface && sharesBoundary ? otherBasinInset : otherCopingOuter]
      // A crossing boundary must remove the whole coping strip, including the
      // half that lies just outside the other basin. On a collinear exterior
      // run the owner keeps its strip while the non-owner is removed.
      const copingRegions = wallCapRegions
      // At one water level the two basins should merge across the exact
      // intersecting footprint. One deterministic pool owns the shared floor
      // and water while the other is clipped away, preventing both a bottom
      // hole and coplanar water z-fighting. Both shells and coping are cut.
      return [{
        footprint: exactRegions[0]!,
        regions: ownsSharedSurface ? [] : exactRegions,
        wallRegions,
        wallCapRegions,
        topHeights: [],
        trimBasin: true,
        copingFootprints: copingRegions,
        copingMiterKeeps: buildCopingMiterKeeps(currentOutlines.basin, currentOutlines.copingOuter, otherBasin, otherCopingOuter),
        suppressSeparator: true,
        preserveWater: ownsSharedSurface,
      }]
    }
    if (otherHeight < poolHeight) {
      // The higher pool keeps its basin, but its coping still needs to stop
      // at the shared intersection edge.
      return [{ footprint: localRegions[0]!, regions: [], topHeights: [], trimBasin: false, copingFootprints: localRegions }]
    }
    seen.add(otherId)
    const polygon = resolvePoolPolygon(other)
    const outline = buildPoolOutlines(polygon, other).shellOuter
    const depth = getPoolDepthResolver(other, polygon)
    const cuts = depth.profile.kind === 'shallow-to-deep'
      ? [depth.minimumX + (depth.maximumX-depth.minimumX)*depth.profile.slopeStart/100,
        depth.minimumX + (depth.maximumX-depth.minimumX)*depth.profile.slopeEnd/100] : []
    const boundary = outline.flatMap((a,index) => {
      const b = outline[(index+1)%outline.length]!
      const ts = cuts.map(x => (x-a[0])/(b[0]-a[0])).filter(t => t>0 && t<1).sort((a,b)=>a-b)
      return [a,...ts.map((t):PoolPoint => [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])]
    })
    const footprint = boundary.map(([x,z]): PoolPoint => {
      const dx = other.position[0] + x*Math.cos(other.rotation[1]) + z*Math.sin(other.rotation[1]) - pool.position[0]
      const dz = other.position[2] - x*Math.sin(other.rotation[1]) + z*Math.cos(other.rotation[1]) - pool.position[2]
      return [dx*Math.cos(pool.rotation[1])-dz*Math.sin(pool.rotation[1]),dx*Math.sin(pool.rotation[1])+dz*Math.cos(pool.rotation[1])]
    })
    const topHeights = boundary.map(([x]) => other.position[1]+other.finishedDeckElevation-depth.depthAtX(x)-pool.position[1]-pool.finishedDeckElevation)
    const winding = Math.sign(footprint.reduce((sum,a,index) => {
      const b=footprint[(index+1)%footprint.length]!
      return sum+a[0]*b[1]-b[0]*a[1]
    },0))
    const convex = footprint.every((a,index) => {
      const b=footprint[(index+1)%footprint.length]!
      const c=footprint[(index+2)%footprint.length]!
      return ((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))*winding >= -1e-8
    })
    const regions = convex ? [footprint] : ShapeUtils.triangulateShape(footprint.map(([x,z])=>new Vector2(x,z)),[])
      .map(indices=>indices.map(index=>footprint[index]!))
    return [{footprint,topHeights,regions}]
  })
}
