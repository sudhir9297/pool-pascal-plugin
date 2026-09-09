import { POOL_SHAPES, type PoolShape } from '../core/pool-options'
import type { PoolPoint } from '../core/schema-primitives'
export { POOL_SHAPES, type PoolShape } from '../core/pool-options'

export const POOL_SHAPE_OPTIONS: ReadonlyArray<{
  label: string
  value: PoolShape
}> = [
  { label: 'Rectangle', value: 'rectangle' },
  { label: 'Circular', value: 'circle' },
  { label: 'Lap rectangle', value: 'lap-rectangle' },
  { label: 'Kidney', value: 'kidney' },
  { label: 'Lagoon', value: 'lagoon' },
  { label: 'Roman', value: 'roman' },
  { label: 'L-shape', value: 'l-shape' },
  { label: 'Freehand', value: 'spline' },
  { label: 'Custom', value: 'custom' },
]

export const DEFAULT_POOL_SHAPE_DIMENSIONS: Record<PoolShape, {
  length: number
  width: number
}> = {
  rectangle: { length: 8, width: 4 },
  circle: { length: 6, width: 6 },
  'lap-rectangle': { length: 12, width: 2.5 },
  kidney: { length: 8, width: 4.5 },
  lagoon: { length: 9, width: 5.5 },
  roman: { length: 9, width: 4.5 },
  'l-shape': { length: 8, width: 6 },
  spline: { length: 8, width: 4 },
  custom: { length: 8, width: 4 },
}

const CURVE_SEGMENTS = 32
const MIN_DIMENSION = 0.5
const SPLINE_SEGMENTS_PER_SPAN = 8

export function isDrawnPoolShape(shape: PoolShape): shape is 'spline' | 'custom' {
  return shape === 'spline' || shape === 'custom'
}

function distance(a: PoolPoint, b: PoolPoint): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

function cubicBezier(
  start: PoolPoint,
  control1: PoolPoint,
  control2: PoolPoint,
  end: PoolPoint,
  t: number,
): PoolPoint {
  const inverse = 1 - t
  const a = inverse ** 3
  const b = 3 * inverse * inverse * t
  const c = 3 * inverse * t * t
  const d = t ** 3
  return [
    a * start[0] + b * control1[0] + c * control2[0] + d * end[0],
    a * start[1] + b * control1[1] + c * control2[1] + d * end[1],
  ]
}

/**
 * Samples a smooth closed curve through every supplied anchor. Automatic
 * mirrored handles keep the outline tangent-continuous without adding a
 * separate handle-editing step to pool placement.
 */
export function sampleClosedPoolSpline(
  anchors: readonly PoolPoint[],
  segmentsPerSpan = SPLINE_SEGMENTS_PER_SPAN,
  curveStrength = 1,
): PoolPoint[] {
  if (anchors.length < 3) return anchors.map(([x, z]) => [x, z])
  const steps = Math.max(1, Math.floor(segmentsPerSpan))
  const count = anchors.length
  const strength = Math.max(0, Math.min(1, curveStrength))
  const handles = anchors.map((anchor, index): PoolPoint => {
    const previous = anchors[(index - 1 + count) % count]!
    const next = anchors[(index + 1) % count]!
    const directionX = next[0] - previous[0]
    const directionZ = next[1] - previous[1]
    const directionLength = Math.hypot(directionX, directionZ)
    const handleLength = Math.min(distance(anchor, previous), distance(anchor, next)) / 3 * strength
    if (directionLength < 1e-6 || handleLength < 1e-6) return [0, 0]
    return [
      directionX / directionLength * handleLength,
      directionZ / directionLength * handleLength,
    ]
  })

  return anchors.flatMap((start, index) => {
    const end = anchors[(index + 1) % count]!
    const startHandle = handles[index]!
    const endHandle = handles[(index + 1) % count]!
    const control1: PoolPoint = [start[0] + startHandle[0], start[1] + startHandle[1]]
    const control2: PoolPoint = [end[0] - endHandle[0], end[1] - endHandle[1]]
    return Array.from({ length: steps }, (_, sampleIndex) => cubicBezier(
      start,
      control1,
      control2,
      end,
      sampleIndex / steps,
    ))
  })
}

function rectangle(length: number, width: number): PoolPoint[] {
  const halfLength = length / 2
  const halfWidth = width / 2
  return [
    [-halfLength, -halfWidth],
    [halfLength, -halfWidth],
    [halfLength, halfWidth],
    [-halfLength, halfWidth],
  ]
}

function ellipse(length: number, width: number): PoolPoint[] {
  return Array.from({ length: CURVE_SEGMENTS }, (_, index): PoolPoint => {
    const angle = index / CURVE_SEGMENTS * Math.PI * 2
    return [length / 2 * Math.cos(angle), width / 2 * Math.sin(angle)]
  })
}

function normalizeBounds(
  points: PoolPoint[],
  targetLength: number,
  targetWidth: number,
): PoolPoint[] {
  const xs = points.map(([x]) => x)
  const zs = points.map(([, z]) => z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  const scaleX = targetLength / Math.max(maxX - minX, Number.EPSILON)
  const scaleZ = targetWidth / Math.max(maxZ - minZ, Number.EPSILON)
  return points.map(([x, z]) => [
    (x - centerX) * scaleX,
    (z - centerZ) * scaleZ,
  ])
}

function kidney(length: number, width: number): PoolPoint[] {
  const halfLength = length / 2
  const halfWidth = width / 2
  const points = Array.from({ length: CURVE_SEGMENTS }, (_, index): PoolPoint => {
    const angle = (index / CURVE_SEGMENTS) * Math.PI * 2
    const x = halfLength * Math.cos(angle)
    const ellipseZ = halfWidth * Math.sin(angle)
    const waist = Math.exp(-((x / (halfLength * 0.42)) ** 2))
    const inset = ellipseZ > 0 ? halfWidth * 0.34 * waist * Math.sin(angle) : 0
    return [x, ellipseZ - inset]
  })
  return normalizeBounds(points, length, width)
}

const LAGOON_CONTROL_POINTS: readonly PoolPoint[] = [
  [-1, -0.1],
  [-0.88, -0.62],
  [-0.55, -0.9],
  [-0.1, -0.78],
  [0.28, -1],
  [0.72, -0.72],
  [1, -0.28],
  [0.86, 0.16],
  [0.95, 0.55],
  [0.55, 0.88],
  [0.1, 0.72],
  [-0.25, 1],
  [-0.67, 0.75],
  [-0.88, 0.38],
] as const

/**
 * Produces a stable resort-style freeform outline. The control points stay
 * deliberately deterministic so save/reload, undo, and visual snapshots do
 * not change the pool silhouette.
 */
function lagoon(length: number, width: number): PoolPoint[] {
  const samplesPerCurve = 6
  const points = LAGOON_CONTROL_POINTS.flatMap((_, controlIndex) => {
    const count = LAGOON_CONTROL_POINTS.length
    const previous = LAGOON_CONTROL_POINTS[(controlIndex - 1 + count) % count]!
    const current = LAGOON_CONTROL_POINTS[controlIndex]!
    const next = LAGOON_CONTROL_POINTS[(controlIndex + 1) % count]!
    const following = LAGOON_CONTROL_POINTS[(controlIndex + 2) % count]!

    return Array.from({ length: samplesPerCurve }, (_, sampleIndex): PoolPoint => {
      const t = sampleIndex / samplesPerCurve
      const t2 = t * t
      const t3 = t2 * t
      const interpolate = (axis: 0 | 1) => 0.5 * (
        2 * current[axis]
        + (-previous[axis] + next[axis]) * t
        + (2 * previous[axis] - 5 * current[axis] + 4 * next[axis] - following[axis]) * t2
        + (-previous[axis] + 3 * current[axis] - 3 * next[axis] + following[axis]) * t3
      )
      return [interpolate(0), interpolate(1)]
    })
  })

  return normalizeBounds(points, length, width)
}

function roman(length: number, width: number): PoolPoint[] {
  const radius = Math.min(width / 2, length / 2)
  const straightHalfLength = Math.max(0, length / 2 - radius)
  if (straightHalfLength === 0) {
    return Array.from({ length: CURVE_SEGMENTS }, (_, index): PoolPoint => {
      const angle = (index / CURVE_SEGMENTS) * Math.PI * 2
      return [length / 2 * Math.cos(angle), width / 2 * Math.sin(angle)]
    })
  }

  const arcSegments = CURVE_SEGMENTS / 2
  const right = Array.from({ length: arcSegments + 1 }, (_, index): PoolPoint => {
    const angle = -Math.PI / 2 + (index / arcSegments) * Math.PI
    return [straightHalfLength + radius * Math.cos(angle), radius * Math.sin(angle)]
  })
  const left = Array.from({ length: arcSegments + 1 }, (_, index): PoolPoint => {
    const angle = Math.PI / 2 + (index / arcSegments) * Math.PI
    return [-straightHalfLength + radius * Math.cos(angle), radius * Math.sin(angle)]
  })
  return [...right, ...left]
}

function lShape(length: number, width: number): PoolPoint[] {
  const halfLength = length / 2
  const halfWidth = width / 2
  const legWidth = length * 0.45
  const legDepth = width * 0.45
  return [
    [-halfLength, -halfWidth],
    [halfLength, -halfWidth],
    [halfLength, -halfWidth + legDepth],
    [-halfLength + legWidth, -halfWidth + legDepth],
    [-halfLength + legWidth, halfWidth],
    [-halfLength, halfWidth],
  ]
}

export function createPoolShapePolygon(
  shape: PoolShape,
  requestedLength: number,
  requestedWidth: number,
): PoolPoint[] {
  const length = Math.max(MIN_DIMENSION, requestedLength)
  const width = Math.max(MIN_DIMENSION, requestedWidth)
  switch (shape) {
    case 'circle':
      return ellipse(length, length)
    case 'kidney':
      return kidney(length, width)
    case 'lagoon':
      return lagoon(length, width)
    case 'roman':
      return roman(length, width)
    case 'l-shape':
      return lShape(length, width)
    case 'spline':
      return ellipse(length, width)
    case 'rectangle':
    case 'lap-rectangle':
    case 'custom':
      return rectangle(length, width)
  }
}

export function getPoolPolygonDimensions(points: PoolPoint[]): {
  length: number
  width: number
} {
  const xs = points.map(([x]) => x)
  const zs = points.map(([, z]) => z)
  return {
    length: Math.max(...xs) - Math.min(...xs),
    width: Math.max(...zs) - Math.min(...zs),
  }
}

export function isPoolPolygonPlaceable(points: PoolPoint[]): boolean {
  if (points.length < 3 || points.some(([x, z]) => !Number.isFinite(x) || !Number.isFinite(z))) return false
  if (points.some((point, index) => {
    const next = points[(index + 1) % points.length]!
    return Math.hypot(next[0] - point[0], next[1] - point[1]) < 1e-6
  })) return false
  const { length, width } = getPoolPolygonDimensions(points)
  if (length < MIN_DIMENSION || width < MIN_DIMENSION) return false

  const doubledArea = points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]
    return next ? area + point[0] * next[1] - next[0] * point[1] : area
  }, 0)
  if (Math.abs(doubledArea) < MIN_DIMENSION * MIN_DIMENSION * 2) return false

  const orientation = (a: PoolPoint, b: PoolPoint, c: PoolPoint) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  const intersects = (a: PoolPoint, b: PoolPoint, c: PoolPoint, d: PoolPoint) => {
    const ab = orientation(a, b, c)
    const ab2 = orientation(a, b, d)
    const cd = orientation(c, d, a)
    const cd2 = orientation(c, d, b)
    return ((ab > 1e-8 && ab2 < -1e-8) || (ab < -1e-8 && ab2 > 1e-8)) &&
      ((cd > 1e-8 && cd2 < -1e-8) || (cd < -1e-8 && cd2 > 1e-8))
  }
  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length
    for (let other = index + 1; other < points.length; other += 1) {
      const otherNext = (other + 1) % points.length
      if (index === other || next === other || index === otherNext) continue
      if (intersects(points[index]!, points[next]!, points[other]!, points[otherNext]!)) return false
    }
  }
  return true
}
