import type { PoolPoint } from '../core/schema'

const GEOMETRY_TOLERANCE = 1e-7
const COORDINATE_PRECISION = 1e9
const MITER_LIMIT = 10

export type PoolOutlineDimensions = {
  shellThickness: number
  copingWidth: number
  coveRadius: number
  openingClearance: number
}

export type PoolOutlines = {
  basin: PoolPoint[]
  shellOuter: PoolPoint[]
  copingOuter: PoolPoint[]
  coveInner: PoolPoint[]
  constructionOpening: PoolPoint[]
  warnings: string[]
}

function roundCoordinate(value: number) {
  return Math.round(value * COORDINATE_PRECISION) / COORDINATE_PRECISION
}

function cross(left: PoolPoint, right: PoolPoint) {
  return left[0] * right[1] - left[1] * right[0]
}

function signedArea(polygon: PoolPoint[]) {
  return polygon.reduce((area, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return next ? area + cross(point, next) : area
  }, 0) / 2
}

function outwardNormal(start: PoolPoint, end: PoolPoint, winding: 1 | -1): PoolPoint {
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  const length = Math.hypot(dx, dz)
  if (length <= GEOMETRY_TOLERANCE) return [0, 0]
  return winding === 1 ? [dz / length, -dx / length] : [-dz / length, dx / length]
}

function intersectLines(
  leftPoint: PoolPoint,
  leftDirection: PoolPoint,
  rightPoint: PoolPoint,
  rightDirection: PoolPoint,
): PoolPoint | null {
  const denominator = cross(leftDirection, rightDirection)
  if (Math.abs(denominator) <= GEOMETRY_TOLERANCE) return null
  const delta: PoolPoint = [rightPoint[0] - leftPoint[0], rightPoint[1] - leftPoint[1]]
  const distance = cross(delta, rightDirection) / denominator
  return [
    leftPoint[0] + leftDirection[0] * distance,
    leftPoint[1] + leftDirection[1] * distance,
  ]
}

function orientation(a: PoolPoint, b: PoolPoint, c: PoolPoint) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

function segmentsIntersect(a: PoolPoint, b: PoolPoint, c: PoolPoint, d: PoolPoint) {
  const abC = orientation(a, b, c)
  const abD = orientation(a, b, d)
  const cdA = orientation(c, d, a)
  const cdB = orientation(c, d, b)
  return ((abC > GEOMETRY_TOLERANCE && abD < -GEOMETRY_TOLERANCE)
      || (abC < -GEOMETRY_TOLERANCE && abD > GEOMETRY_TOLERANCE))
    && ((cdA > GEOMETRY_TOLERANCE && cdB < -GEOMETRY_TOLERANCE)
      || (cdA < -GEOMETRY_TOLERANCE && cdB > GEOMETRY_TOLERANCE))
}

export function isSimplePoolPolygon(polygon: PoolPoint[]) {
  if (polygon.length < 3 || polygon.some(([x, z]) => !Number.isFinite(x) || !Number.isFinite(z))) {
    return false
  }
  if (Math.abs(signedArea(polygon)) <= GEOMETRY_TOLERANCE) return false
  for (let index = 0; index < polygon.length; index += 1) {
    const next = (index + 1) % polygon.length
    if (Math.hypot(
      polygon[next]![0] - polygon[index]![0],
      polygon[next]![1] - polygon[index]![1],
    ) <= GEOMETRY_TOLERANCE) return false
    for (let other = index + 1; other < polygon.length; other += 1) {
      const otherNext = (other + 1) % polygon.length
      if (index === other || next === other || index === otherNext) continue
      if (segmentsIntersect(
        polygon[index]!, polygon[next]!, polygon[other]!, polygon[otherNext]!,
      )) return false
    }
  }
  return true
}

/** Returns a point-for-point mitered outline at a constant signed distance. */
export function outsetPoolPolygon(polygon: PoolPoint[], distance: number): PoolPoint[] {
  if (polygon.length < 3 || distance === 0) return polygon.map(([x, z]) => [x, z])
  const winding = signedArea(polygon) >= 0 ? 1 : -1
  return polygon.map((point, index) => {
    const previous = polygon[(index - 1 + polygon.length) % polygon.length]!
    const next = polygon[(index + 1) % polygon.length]!
    const previousNormal = outwardNormal(previous, point, winding)
    const nextNormal = outwardNormal(point, next, winding)
    const previousOffset: PoolPoint = [
      point[0] + previousNormal[0] * distance,
      point[1] + previousNormal[1] * distance,
    ]
    const nextOffset: PoolPoint = [
      point[0] + nextNormal[0] * distance,
      point[1] + nextNormal[1] * distance,
    ]
    const intersection = intersectLines(
      previousOffset,
      [point[0] - previous[0], point[1] - previous[1]],
      nextOffset,
      [next[0] - point[0], next[1] - point[1]],
    )
    const candidate: PoolPoint = intersection ?? [
      point[0] + (previousNormal[0] + nextNormal[0]) * distance * 0.5,
      point[1] + (previousNormal[1] + nextNormal[1]) * distance * 0.5,
    ]
    const miterLength = Math.hypot(candidate[0] - point[0], candidate[1] - point[1])
    const bounded = miterLength <= Math.abs(distance) * MITER_LIMIT
      ? candidate
      : previousOffset
    return [roundCoordinate(bounded[0]), roundCoordinate(bounded[1])]
  })
}

function safeOffset(
  polygon: PoolPoint[],
  requestedDistance: number,
  label: string,
  warnings: string[],
) {
  if (requestedDistance === 0) return polygon.map(([x, z]): PoolPoint => [x, z])
  let distance = requestedDistance
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const candidate = outsetPoolPolygon(polygon, distance)
    if (candidate.length === polygon.length && isSimplePoolPolygon(candidate)) {
      if (attempt > 0) warnings.push(
        `${label} offset was reduced from ${requestedDistance} m to ${distance} m to avoid self-intersection.`,
      )
      return candidate
    }
    distance *= 0.75
  }
  warnings.push(`${label} offset could not be constructed safely; the basin outline was reused.`)
  return polygon.map(([x, z]): PoolPoint => [x, z])
}

/** Builds every structural outline through one validated, deterministic seam. */
export function buildPoolOutlines(
  polygon: PoolPoint[],
  dimensions: PoolOutlineDimensions,
): PoolOutlines {
  if (!isSimplePoolPolygon(polygon)) throw new Error('Pool basin outline must be a simple polygon.')
  const basin = polygon.map(([x, z]): PoolPoint => [roundCoordinate(x), roundCoordinate(z)])
  const warnings: string[] = []
  const shellThickness = Math.max(0, dimensions.shellThickness)
  const copingWidth = Math.max(shellThickness + 0.03, dimensions.copingWidth)
  const coveRadius = Math.max(0, dimensions.coveRadius)
  const openingClearance = Math.max(0, dimensions.openingClearance)
  return {
    basin,
    shellOuter: safeOffset(basin, shellThickness, 'Shell', warnings),
    copingOuter: safeOffset(basin, copingWidth, 'Coping', warnings),
    coveInner: safeOffset(basin, -coveRadius, 'Cove', warnings),
    constructionOpening: safeOffset(
      basin,
      shellThickness + openingClearance,
      'Construction opening',
      warnings,
    ),
    warnings,
  }
}
