import type { PoolPoint } from '../core/schema'

export type NaturalCopingLayoutOptions = {
  width: number
  thickness: number
  stoneLength: number
  jointWidth: number
  irregularity: number
  seed: number
}

export type NaturalCopingStoneLayout = {
  position: [number, number, number]
  corners: [PoolPoint, PoolPoint, PoolPoint, PoolPoint]
  length: number
  width: number
  height: number
  colorOffset: [number, number, number]
}

function seededRandom(seed: number) {
  let state = Math.trunc(seed) || 1
  return () => {
    state = Math.imul(state ^ state >>> 16, 0x21f0aaad)
    state = Math.imul(state ^ state >>> 15, 0x735a2d97)
    return ((state ^= state >>> 15) >>> 0) / 4294967296
  }
}

function boundaryLengths(points: PoolPoint[]) {
  const lengths = points.map((point, index) => {
    const next = points[(index + 1) % points.length]!
    return Math.hypot(next[0] - point[0], next[1] - point[1])
  })
  return { lengths, perimeter: lengths.reduce((sum, length) => sum + length, 0) }
}

function sampleBoundary(
  points: PoolPoint[],
  lengths: number[],
  perimeter: number,
  requestedDistance: number,
) {
  let distance = ((requestedDistance % perimeter) + perimeter) % perimeter
  for (let index = 0; index < points.length; index += 1) {
    const length = lengths[index]!
    if (distance > length && index < points.length - 1) {
      distance -= length
      continue
    }
    const start = points[index]!
    const end = points[(index + 1) % points.length]!
    const progress = length > 0 ? distance / length : 0
    return {
      point: [
        start[0] + (end[0] - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress,
      ] as PoolPoint,
      tangent: length > 0
        ? [(end[0] - start[0]) / length, (end[1] - start[1]) / length] as PoolPoint
        : [1, 0] as PoolPoint,
    }
  }
  return { point: points[0] ?? [0, 0] as PoolPoint, tangent: [1, 0] as PoolPoint }
}

export function naturalCopingStoneCount(points: PoolPoint[], stoneLength: number) {
  const { perimeter } = boundaryLengths(points)
  return Math.max(3, Math.round(perimeter / Math.max(0.2, stoneLength)))
}

export function layoutNaturalCopingStones(
  points: PoolPoint[],
  options: NaturalCopingLayoutOptions,
): NaturalCopingStoneLayout[] {
  const { lengths, perimeter } = boundaryLengths(points)
  if (points.length < 3 || perimeter <= 0) return []
  const count = naturalCopingStoneCount(points, options.stoneLength)
  const stationLength = perimeter / count
  const random = seededRandom(options.seed)
  const irregularity = Math.max(0, Math.min(1, options.irregularity))

  return Array.from({ length: count }, (_, index) => {
    const centerDistance = (index + 0.5) * stationLength
    const lengthVariation = 1 + (random() - 0.5) * irregularity * 0.12
    const length = Math.max(0.12, (stationLength - options.jointWidth) * lengthVariation)
    const start = sampleBoundary(points, lengths, perimeter, centerDistance - length / 2)
    const end = sampleBoundary(points, lengths, perimeter, centerDistance + length / 2)
    const width = Math.max(0.1, options.width * (1 + (random() - 0.5) * irregularity * 0.18))
    const height = Math.max(
      0.02,
      options.thickness * (1 + (random() - 0.5) * irregularity * 0.3),
    )
    // Consume the former yaw random value so saved seeds retain their color
    // sequence after switching from rectangular stones to fitted trapezoids.
    random()
    const startOutward: PoolPoint = [start.tangent[1], -start.tangent[0]]
    const endOutward: PoolPoint = [end.tangent[1], -end.tangent[0]]
    const corners: NaturalCopingStoneLayout['corners'] = [
      start.point,
      end.point,
      [end.point[0] + endOutward[0] * width, end.point[1] + endOutward[1] * width],
      [start.point[0] + startOutward[0] * width, start.point[1] + startOutward[1] * width],
    ]
    const center = corners.reduce(
      (sum, point) => [sum[0] + point[0] / 4, sum[1] + point[1] / 4] as PoolPoint,
      [0, 0] as PoolPoint,
    )
    return {
      position: [center[0], 0, center[1]],
      corners,
      length,
      width,
      height,
      colorOffset: [
        (random() - 0.5) * 0.015,
        (random() - 0.5) * 0.08,
        (random() - 0.5) * 0.12,
      ],
    }
  })
}
