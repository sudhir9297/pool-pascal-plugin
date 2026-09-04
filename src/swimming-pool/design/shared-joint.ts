import type { AnyNode } from '@pascal-app/core'
import { ShapeUtils, Vector2 } from 'three'
import { PoolNode, type PoolPoint, resolvePoolPolygon } from '../core/schema'
import { PoolSharedJointNode } from '../shared-joint/core/schema'
import { PoolSpilloverNode } from '../spillover/core/schema'

type WorldSegment = { start: PoolPoint; end: PoolPoint; tangent: PoolPoint }
const INTERSECTION_EPSILON = 1e-6

function worldPolygon(pool: PoolNode): PoolPoint[] {
  const rotation = pool.rotation[1] ?? 0
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  return resolvePoolPolygon(pool).map(([x, z]) => [
    pool.position[0] + x * cos + z * sin,
    pool.position[2] - x * sin + z * cos,
  ])
}

function worldSegments(pool: PoolNode): WorldSegment[] {
  const points = worldPolygon(pool)
  return points.flatMap((start, index) => {
    const end = points[(index + 1) % points.length]
    if (!end) return []
    const length = Math.hypot(end[0] - start[0], end[1] - start[1])
    return length > 0.001
      ? [{ start, end, tangent: [(end[0] - start[0]) / length, (end[1] - start[1]) / length] as PoolPoint }]
      : []
  })
}

function dot(left: PoolPoint, right: PoolPoint) {
  return left[0] * right[0] + left[1] * right[1]
}

function addScaled(point: PoolPoint, direction: PoolPoint, scale: number): PoolPoint {
  return [point[0] + direction[0] * scale, point[1] + direction[1] * scale]
}

function signedArea(points: PoolPoint[]) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]!
    return area + point[0] * next[1] - next[0] * point[1]
  }, 0) / 2
}

function ensureCounterClockwise(points: PoolPoint[]) {
  return signedArea(points) >= 0 ? points : [...points].reverse()
}

function clipConvexPolygon(subject: PoolPoint[], clip: PoolPoint[]) {
  let output = subject
  for (let index = 0; index < clip.length && output.length >= 3; index += 1) {
    const start = clip[index]!
    const end = clip[(index + 1) % clip.length]!
    const edge = [end[0] - start[0], end[1] - start[1]] as PoolPoint
    const inside = (point: PoolPoint) => edge[0] * (point[1] - start[1]) - edge[1] * (point[0] - start[0]) >= -INTERSECTION_EPSILON
    const nextOutput: PoolPoint[] = []
    for (let pointIndex = 0; pointIndex < output.length; pointIndex += 1) {
      const current = output[pointIndex]!
      const next = output[(pointIndex + 1) % output.length]!
      const currentInside = inside(current)
      const nextInside = inside(next)
      if (currentInside !== nextInside) {
        const currentToNext = [next[0] - current[0], next[1] - current[1]] as PoolPoint
        const denominator = edge[0] * currentToNext[1] - edge[1] * currentToNext[0]
        const progress = denominator === 0
          ? 0
          : (edge[0] * (start[1] - current[1]) - edge[1] * (start[0] - current[0])) / denominator
        nextOutput.push([current[0] + currentToNext[0] * progress, current[1] + currentToNext[1] * progress])
      }
      if (nextInside) nextOutput.push(next)
    }
    output = nextOutput
  }
  return output
}

function trianglePolygons(points: PoolPoint[]) {
  const polygon = ensureCounterClockwise(points)
  const vertices = polygon.map(([x, z]) => new Vector2(x, z))
  return ShapeUtils.triangulateShape(vertices, []).map((triangle) => triangle.map((index) => polygon[index]!))
}

/** Returns a non-overlapping convex decomposition of two pool polygons' overlap. */
export function getPoolIntersectionRegions(first: PoolNode, second: PoolNode): PoolPoint[][] {
  const firstTriangles = trianglePolygons(worldPolygon(first))
  const secondTriangles = trianglePolygons(worldPolygon(second))
  return firstTriangles.flatMap((firstTriangle) =>
    secondTriangles.flatMap((secondTriangle) => {
      const intersection = clipConvexPolygon(firstTriangle, ensureCounterClockwise(secondTriangle))
      return Math.abs(signedArea(intersection)) > INTERSECTION_EPSILON ? [intersection] : []
    }),
  )
}

export type SharedPoolJoint = {
  position: [number, number, number]
  rotation: [number, number, number]
  length: number
  width: number
  intersection: PoolPoint[][]
  commonFloorDepth: number
  copingStyle: PoolSharedJointNode['copingStyle']
  surfaceColor: string
  poolPoints: [PoolPoint, PoolPoint]
}

function poolDeckHeight(pool: PoolNode) {
  return pool.position[1] + pool.finishedDeckElevation
}

function poolFloorDepth(pool: PoolNode) {
  return pool.floorProfile === 'flat' ? pool.depth : pool.deepDepth
}

function regionCentroid(region: PoolPoint[]): PoolPoint {
  const area = signedArea(region)
  if (Math.abs(area) <= INTERSECTION_EPSILON) {
    return region.reduce((sum, point) => [sum[0] + point[0] / region.length, sum[1] + point[1] / region.length] as PoolPoint, [0, 0] as PoolPoint)
  }
  return region.reduce((sum, point, index) => {
    const next = region[(index + 1) % region.length]!
    const cross = point[0] * next[1] - next[0] * point[1]
    return [sum[0] + (point[0] + next[0]) * cross, sum[1] + (point[1] + next[1]) * cross] as PoolPoint
  }, [0, 0] as PoolPoint).map((value) => value / (6 * area)) as PoolPoint
}

export type SharedPoolJointChanges = {
  create: PoolSharedJointNode[]
  update: Array<{ id: string; data: Partial<PoolSharedJointNode> }>
  delete: string[]
}

/** Returns each connection's exact position in a pool's local X/Z plane. */
export function getPoolConnectionPoints(
  pool: PoolNode,
  nodes: Record<string, AnyNode>,
): PoolPoint[] {
  const rotation = pool.rotation[1] ?? 0
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  return Object.values(nodes)
    .filter((node) => ['pool:shared-joint', 'pool:spillover'].includes(String(node.type)))
    .flatMap((node) => {
      const parsed = String(node.type) === 'pool:spillover' ? PoolSpilloverNode.safeParse(node) : PoolSharedJointNode.safeParse(node)
      if (!parsed.success) return []
      const connection = String(node.type) === 'pool:spillover' ? PoolSpilloverNode.parse(node) : PoolSharedJointNode.parse(node)
      const ids = 'sourcePoolId' in connection ? [connection.sourcePoolId, connection.targetPoolId] : connection.poolIds
      if (!ids.includes(pool.id)) return []
      const dx = connection.position[0] - pool.position[0]
      const dz = connection.position[2] - pool.position[2]
      return [[dx * cos - dz * sin, dx * sin + dz * cos]]
    })
}

/** Returns exact overlap regions in the pool's local X/Z plane. */
export function getPoolConnectionRegions(
  pool: PoolNode,
  nodes: Record<string, AnyNode>,
): PoolPoint[][] {
  const rotation = pool.rotation[1] ?? 0
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  return Object.values(nodes)
    .filter((node) => ['pool:shared-joint', 'pool:spillover'].includes(String(node.type)))
    .flatMap((node) => {
      let regions: PoolPoint[][]
      if (String(node.type) === 'pool:spillover') {
        const parsed = PoolSpilloverNode.safeParse(node)
        if (!parsed.success) return []
        const connection = parsed.data
        if (connection.sourcePoolId === pool.id) {
          regions = connection.sourceOpening.length >= 3
            ? [connection.sourceOpening]
            : connection.intersection
        } else if (connection.targetPoolId === pool.id) {
          regions = connection.targetOpening.length >= 3
            ? [connection.targetOpening]
            : connection.intersection
        } else return []
      } else {
        const parsed = PoolSharedJointNode.safeParse(node)
        if (!parsed.success || !parsed.data.poolIds.includes(pool.id)) return []
        regions = parsed.data.intersection
      }
      return regions.map((region) => region.map(([x, z]) => {
        const dx = x - pool.position[0]
        const dz = z - pool.position[2]
        return [dx * cos - dz * sin, dx * sin + dz * cos] as PoolPoint
      }))
    })
}

/** Detects the closest overlapping, nearly parallel pool-wall pair. */
export function findSharedPoolJoint(
  first: PoolNode,
  second: PoolNode,
  clearance = 0.75,
): SharedPoolJoint | null {
  const intersection = getPoolIntersectionRegions(first, second)
  if (intersection.length === 0) return null
  const firstSegments = worldSegments(first)
  const secondSegments = worldSegments(second)
  let best: {
    gap: number
    overlap: number
    position: PoolPoint
    tangent: PoolPoint
    poolPoints: [PoolPoint, PoolPoint]
  } | null = null

  for (const left of firstSegments) {
    const leftLength = Math.hypot(left.end[0] - left.start[0], left.end[1] - left.start[1])
    const leftOrigin = left.start
    const leftNormal: PoolPoint = [-left.tangent[1], left.tangent[0]]
    const leftStart = dot(left.start, left.tangent)
    const leftEnd = dot(left.end, left.tangent)
    const leftLine = dot(leftOrigin, leftNormal)
    for (const right of secondSegments) {
      // A connection wall should be a shared run, not a point-to-point corner.
      const parallel = Math.abs(left.tangent[0] * right.tangent[1] - left.tangent[1] * right.tangent[0])
      if (parallel > 0.2) continue
      const rightStart = dot(right.start, left.tangent)
      const rightEnd = dot(right.end, left.tangent)
      const overlap = Math.min(Math.max(leftStart, leftEnd), Math.max(rightStart, rightEnd)) -
        Math.max(Math.min(leftStart, leftEnd), Math.min(rightStart, rightEnd))
      if (overlap < Math.min(0.25, leftLength * 0.3)) continue
      const gap = Math.abs(dot(right.start, leftNormal) - leftLine)
      if (gap > clearance) continue
      // For overlapping polygons, the shared wall is the pair with the
      // longest common run. A zero-gap corner edge can otherwise win before
      // the actual intersecting side is considered.
      if (best && (
        overlap < best.overlap - 0.001 ||
        (Math.abs(overlap - best.overlap) <= 0.001 && gap > best.gap + 0.001)
      )) continue
      const centerAlongEdge = (
        Math.max(Math.min(leftStart, leftEnd), Math.min(rightStart, rightEnd)) +
        Math.min(Math.max(leftStart, leftEnd), Math.max(rightStart, rightEnd))
      ) / 2
      const leftPoint = addScaled([0, 0], left.tangent, centerAlongEdge)
      const rightPoint = addScaled([0, 0], left.tangent, centerAlongEdge)
      const leftOffset = leftLine - dot(leftPoint, leftNormal)
      const rightLine = dot(right.start, leftNormal)
      const rightOffset = rightLine - dot(rightPoint, leftNormal)
      const firstPoint = addScaled(leftPoint, leftNormal, leftOffset)
      const secondPoint = addScaled(rightPoint, leftNormal, rightOffset)
      const position: PoolPoint = [
        (firstPoint[0] + secondPoint[0]) / 2,
        (firstPoint[1] + secondPoint[1]) / 2,
      ]
      best = { gap, overlap, position, tangent: left.tangent, poolPoints: [firstPoint, secondPoint] }
    }
  }

  if (!best) return null
  const center = intersection.reduce((sum, region) => {
    const centroid = regionCentroid(region)
    return [sum[0] + centroid[0] / intersection.length, sum[1] + centroid[1] / intersection.length] as PoolPoint
  }, [0, 0] as PoolPoint)
  const tangent = best.tangent
  const normal: PoolPoint = [-tangent[1], tangent[0]]
  const tangentCoordinates = intersection.flatMap((region) => region.map((point) => dot(point, tangent)))
  const normalCoordinates = intersection.flatMap((region) => region.map((point) => dot(point, normal)))
  const intersectionWidth = Math.max(...tangentCoordinates) - Math.min(...tangentCoordinates)
  const intersectionDepth = Math.max(...normalCoordinates) - Math.min(...normalCoordinates)
  return {
    // Anchor the connection at the lower finished deck. This keeps the
    // transition aligned when either pool is moved vertically or has a
    // different finished-deck elevation.
    position: [center[0], Math.min(poolDeckHeight(first), poolDeckHeight(second)), center[1]],
    rotation: [0, Math.atan2(tangent[0], tangent[1]), 0],
    length: Math.max(0.12, intersectionDepth),
    width: Math.max(0.12, intersectionWidth),
    intersection,
    commonFloorDepth: Math.max(poolFloorDepth(first), poolFloorDepth(second)),
    copingStyle: first.copingStyle,
    surfaceColor: first.copingColor,
    poolPoints: best.poolPoints,
  }
}

function sharedJointId(firstId: string, secondId: string) {
  return `pool-shared-joint_${[firstId, secondId].sort().join('_')}`
}

function jointNeedsUpdate(node: PoolSharedJointNode, joint: SharedPoolJoint) {
  return node.position.some((value, index) => value !== joint.position[index]) ||
    node.rotation.some((value, index) => value !== joint.rotation[index]) ||
    node.length !== joint.length ||
    node.width !== joint.width ||
    node.commonFloorDepth !== joint.commonFloorDepth ||
    node.copingStyle !== joint.copingStyle ||
    node.surfaceColor !== joint.surfaceColor ||
    JSON.stringify(node.intersection) !== JSON.stringify(joint.intersection)
}

/** Derives generated connections from the current pool scene. */
export function syncSharedPoolJoints(nodes: Record<string, AnyNode>): SharedPoolJointChanges {
  const pools = Object.values(nodes)
    .filter((node) => (node.type as string) === 'pool:pool')
    .flatMap((node) => {
      const parsed = PoolNode.safeParse(node)
      return parsed.success ? [parsed.data] : []
    })
  const existing = Object.values(nodes)
    .filter((node) => (node.type as string) === 'pool:shared-joint')
    .flatMap((node) => {
      const parsed = PoolSharedJointNode.safeParse(node)
      return parsed.success ? [parsed.data] : []
    })
  const explicitSpilloverPairs = new Set(Object.values(nodes)
    .filter((node) => (node.type as string) === 'pool:spillover')
    .flatMap((node) => {
      const parsed = PoolSpilloverNode.safeParse(node)
      return parsed.success
        ? [sharedJointId(parsed.data.sourcePoolId, parsed.data.targetPoolId)]
        : []
    }))
  const expected = new Map<string, { first: PoolNode; second: PoolNode; joint: SharedPoolJoint }>()

  for (let firstIndex = 0; firstIndex < pools.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < pools.length; secondIndex += 1) {
      const first = pools[firstIndex]!
      const second = pools[secondIndex]!
      if (first.parentId !== second.parentId) continue
      const id = sharedJointId(first.id, second.id)
      if (explicitSpilloverPairs.has(id)) continue
      const joint = findSharedPoolJoint(first, second)
      if (!joint) continue
      expected.set(id, { first, second, joint })
    }
  }

  const create: PoolSharedJointNode[] = []
  const update: Array<{ id: string; data: Partial<PoolSharedJointNode> }> = []
  for (const [id, value] of expected) {
    const current = existing.find((node) => node.id === id)
    if (!current) {
      create.push(PoolSharedJointNode.parse({
        id,
        name: `Pool connection ${value.first.id} / ${value.second.id}`,
        parentId: value.first.parentId,
        poolIds: [value.first.id, value.second.id],
        ...value.joint,
      }))
    } else if (jointNeedsUpdate(current, value.joint)) {
      update.push({ id, data: value.joint })
    }
  }

  const deleteIds = existing
    .filter((node) => !expected.has(node.id))
    .map((node) => node.id)
  return { create, update, delete: deleteIds }
}
