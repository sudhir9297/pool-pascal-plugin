import type { AnyNode } from '@pascal-app/core'
import { ShapeUtils, Vector2 } from 'three'
import { PoolNode, resolvePoolPolygon, type PoolPoint } from '../core/schema'
import { PoolSpilloverNode } from '../spillover/core/schema'
import { buildPoolOutlines } from './outlines'
import { getPoolDepthResolver } from './depth-profile'
import { getPoolIntersectionRegions } from './shared-joint'

export type PoolOverlap = {
  footprint: PoolPoint[]
  regions: PoolPoint[][]
  topHeights: number[]
  trimBasin?: boolean
  copingFootprints?: PoolPoint[][]
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
    if (Math.abs(otherHeight - poolHeight) <= 0.001) {
      // At one water level the two basins should merge across the exact
      // intersecting footprint. Remove both shells, floors, and coping there;
      // the spillover surface supplies the finished fill plane.
      return [{
        footprint: localRegions[0]!,
        regions: localRegions,
        topHeights: [],
        trimBasin: true,
        copingFootprints: localRegions,
        suppressSeparator: true,
        preserveWater: true,
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
