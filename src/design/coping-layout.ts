import type { PoolPoint } from '../core/schema'

export type NaturalCopingLayoutOptions = {
  width: number
  thickness: number
  stoneLength: number
  jointWidth: number
  irregularity: number
  seed: number
  rockLike?: boolean
  smoothBoundary?: boolean
}

export type NaturalCopingStoneLayout = {
  position: [number, number, number]
  corners: [PoolPoint, PoolPoint, PoolPoint, PoolPoint]
  length: number
  width: number
  height: number
  colorOffset: [number, number, number]
  rockSeed: number
  rockRotation: number
  tangent: PoolPoint
  cornerPoint?: PoolPoint
  cornerTangents?: [PoolPoint, PoolPoint]
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
      segmentIndex: index,
    }
  }
  return { point: points[0] ?? [0, 0] as PoolPoint, tangent: [1, 0] as PoolPoint, segmentIndex: 0 }
}

function naturalCopingStoneCount(points: PoolPoint[], stoneLength: number) {
  const { perimeter } = boundaryLengths(points)
  return Math.max(3, Math.round(perimeter / Math.max(0.2, stoneLength)))
}

function layoutSmoothRockCopingStones(
  points: PoolPoint[],
  options: NaturalCopingLayoutOptions,
  lengths: number[],
  perimeter: number,
) {
  const random = seededRandom(options.seed)
  // The outline points are only a sampled path. Use a coarser global pitch so
  // dense curve sampling cannot create a crowd of tiny rocks.
  const pitch = Math.max(0.4, options.stoneLength * 1.35)
  const count = Math.max(3, Math.round(perimeter / pitch))
  const stationLength = perimeter / count
  const joint = Math.max(0.005, Math.min(0.02, options.jointWidth))
  const stones: NaturalCopingStoneLayout[] = []
  const makeColorOffset = (): [number, number, number] => [
    (random() - 0.5) * 0.015,
    (random() - 0.5) * 0.08,
    (random() - 0.5) * 0.12,
  ]

  for (let index = 0; index < count; index += 1) {
    // Fill each station almost completely. The small joint keeps neighboring
    // beveled volumes from visually merging without making large holes.
    const length = Math.max(0.12, stationLength - joint)
    const start = sampleBoundary(points, lengths, perimeter, index * stationLength)
    const end = sampleBoundary(points, lengths, perimeter, (index + 1) * stationLength)
    const center = sampleBoundary(points, lengths, perimeter, (index + 0.5) * stationLength)
    const tangentLength = Math.hypot(
      start.tangent[0] + end.tangent[0],
      start.tangent[1] + end.tangent[1],
    )
    const tangent: PoolPoint = tangentLength > 0.001
      ? [
          (start.tangent[0] + end.tangent[0]) / tangentLength,
          (start.tangent[1] + end.tangent[1]) / tangentLength,
        ]
      : center.tangent
    const width = Math.max(
      0.1,
      options.width * (1 + (random() - 0.5) * options.irregularity * 0.28),
    )
    const height = Math.max(
      0.02,
      options.thickness * (1 + (random() - 0.5) * options.irregularity * 0.3),
    )
    stones.push({
      position: [center.point[0], 0, center.point[1]],
      corners: [center.point, center.point, center.point, center.point],
      length,
      width,
      height,
      colorOffset: makeColorOffset(),
      rockSeed: Math.floor(random() * 2147483647),
      rockRotation: (random() - 0.5) * 0.025,
      tangent,
    })
  }
  return stones
}

function layoutRockCopingStones(
  points: PoolPoint[],
  options: NaturalCopingLayoutOptions,
  lengths: number[],
) {
  const random = seededRandom(options.seed)
  const stones: NaturalCopingStoneLayout[] = []
  const cornerArm = (edgeLength: number) => Math.min(
    // Each L arm occupies about half a regular rock, so the corner's total
    // footprint stays in the same visual scale as the edge pieces.
    options.stoneLength * 0.36,
    edgeLength * 0.12,
  )
  const makeColorOffset = (): [number, number, number] => [
    (random() - 0.5) * 0.015,
    (random() - 0.5) * 0.08,
    (random() - 0.5) * 0.12,
  ]

  for (let edgeIndex = 0; edgeIndex < points.length; edgeIndex += 1) {
    const start = points[edgeIndex]!
    const end = points[(edgeIndex + 1) % points.length]!
    const edgeLength = lengths[edgeIndex]!
    if (edgeLength <= 0) continue
    const tangent: PoolPoint = [
      (end[0] - start[0]) / edgeLength,
      (end[1] - start[1]) / edgeLength,
    ]
    const arm = cornerArm(edgeLength)
    const usableLength = Math.max(0.12, edgeLength - arm * 2)
    const count = Math.max(1, Math.round(usableLength / Math.max(0.2, options.stoneLength)))
    const stationLength = usableLength / count

    for (let stoneIndex = 0; stoneIndex < count; stoneIndex += 1) {
      const length = Math.max(0.12, stationLength * 0.995)
      const centerDistance = arm + (stoneIndex + 0.5) * stationLength
      const center: PoolPoint = [
        start[0] + tangent[0] * centerDistance,
        start[1] + tangent[1] * centerDistance,
      ]
      const width = Math.max(
        0.1,
        options.width * (1 + (random() - 0.5) * options.irregularity * 0.28),
      )
      const height = Math.max(
        0.02,
        options.thickness * (1 + (random() - 0.5) * options.irregularity * 0.3),
      )
      stones.push({
        position: [center[0], 0, center[1]],
        corners: [
          [center[0] - tangent[0] * length / 2, center[1] - tangent[1] * length / 2],
          [center[0] + tangent[0] * length / 2, center[1] + tangent[1] * length / 2],
          [center[0] + tangent[0] * length / 2 - tangent[1] * width, center[1] + tangent[1] * length / 2 + tangent[0] * width],
          [center[0] - tangent[0] * length / 2 - tangent[1] * width, center[1] - tangent[1] * length / 2 + tangent[0] * width],
        ],
        length,
        width,
        height,
        colorOffset: makeColorOffset(),
        rockSeed: Math.floor(random() * 2147483647),
        rockRotation: (random() - 0.5) * 0.025,
        tangent,
      })
    }

    const cornerIndex = (edgeIndex + 1) % points.length
    const corner = points[cornerIndex]!
    const previous = points[edgeIndex]!
    const next = points[(cornerIndex + 1) % points.length]!
    const incoming: PoolPoint = [
      (corner[0] - previous[0]) / edgeLength,
      (corner[1] - previous[1]) / edgeLength,
    ]
    const outgoingLength = lengths[cornerIndex]!
    const outgoing: PoolPoint = outgoingLength > 0
      ? [(next[0] - corner[0]) / outgoingLength, (next[1] - corner[1]) / outgoingLength]
      : incoming
    const width = Math.max(
      0.1,
      options.width * 0.88 * (1 + (random() - 0.5) * options.irregularity * 0.2),
    )
    const height = Math.max(
      0.02,
      options.thickness * (1 + (random() - 0.5) * options.irregularity * 0.25),
    )
    stones.push({
      position: [corner[0], 0, corner[1]],
      corners: [corner, corner, corner, corner],
      length: Math.max(0.12, arm / 0.58),
      width,
      height,
      colorOffset: makeColorOffset(),
      rockSeed: Math.floor(random() * 2147483647),
      rockRotation: 0,
      tangent: incoming,
      cornerPoint: corner,
      cornerTangents: [incoming, outgoing],
    })
  }
  return stones
}

export function layoutNaturalCopingStones(
  points: PoolPoint[],
  options: NaturalCopingLayoutOptions,
): NaturalCopingStoneLayout[] {
  const { lengths, perimeter } = boundaryLengths(points)
  if (points.length < 3 || perimeter <= 0) return []
  const count = naturalCopingStoneCount(points, options.stoneLength)
  if (options.rockLike) return options.smoothBoundary
    ? layoutSmoothRockCopingStones(points, options, lengths, perimeter)
    : layoutRockCopingStones(points, options, lengths)
  const stationLength = perimeter / count
  const random = seededRandom(options.seed)
  const irregularity = Math.max(0, Math.min(1, options.irregularity))
  const cornerDistances = points.map((_, index) =>
    lengths.slice(0, index).reduce((sum, value) => sum + value, 0),
  )
  const cornerOwners = cornerDistances.map((cornerDistance) => {
    let owner = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < count; index += 1) {
      const centerDistance = (index + 0.5) * stationLength
      const distance = Math.abs(
        ((centerDistance - cornerDistance + perimeter / 2) % perimeter) - perimeter / 2,
      )
      if (distance < nearestDistance) {
        nearestDistance = distance
        owner = index
      }
    }
    return owner
  })

  return Array.from({ length: count }, (_, index) => {
    const centerDistance = (index + 0.5) * stationLength
    const lengthVariation = 1 + (random() - 0.5) * irregularity * (options.rockLike ? 0.18 : 0.12)
    // Rock coping is laid as a fitted chain. Keep each stone inside its station
    // with a hairline clearance rather than allowing neighboring stones to
    // intersect; the flat end faces remain nearly touching.
    const length = options.rockLike
      ? Math.max(0.12, stationLength * 0.995)
      : Math.max(0.12, (stationLength - options.jointWidth) * lengthVariation)
    const start = sampleBoundary(points, lengths, perimeter, centerDistance - length / 2)
    const end = sampleBoundary(points, lengths, perimeter, centerDistance + length / 2)
    const tangentLength = Math.hypot(
      start.tangent[0] + end.tangent[0],
      start.tangent[1] + end.tangent[1],
    )
    const tangent: PoolPoint = tangentLength > 0.001
      ? [
          (start.tangent[0] + end.tangent[0]) / tangentLength,
          (start.tangent[1] + end.tangent[1]) / tangentLength,
        ]
      : start.tangent
    // Give each sharp polygon vertex one owner station. This prevents two
    // neighboring stations from both becoming L pieces at the same corner.
    const cornerIndex = cornerOwners.findIndex((owner) => owner === index)
    const cornerPoint = cornerIndex >= 0 ? points[cornerIndex] : undefined
    const cornerTangents: [PoolPoint, PoolPoint] | undefined = cornerIndex >= 0
      ? [
          lengths[(cornerIndex - 1 + points.length) % points.length]! > 0
            ? [
                (points[cornerIndex]![0] - points[(cornerIndex - 1 + points.length) % points.length]![0]) / lengths[(cornerIndex - 1 + points.length) % points.length]!,
                (points[cornerIndex]![1] - points[(cornerIndex - 1 + points.length) % points.length]![1]) / lengths[(cornerIndex - 1 + points.length) % points.length]!,
              ]
            : start.tangent,
          lengths[cornerIndex]! > 0
            ? [
                (points[(cornerIndex + 1) % points.length]![0] - points[cornerIndex]![0]) / lengths[cornerIndex]!,
                (points[(cornerIndex + 1) % points.length]![1] - points[cornerIndex]![1]) / lengths[cornerIndex]!,
              ]
            : end.tangent,
        ]
      : undefined
    const tangentTurn = Math.abs(start.tangent[0] * end.tangent[1] - start.tangent[1] * end.tangent[0])
    const cornerWidthFactor = options.rockLike
      ? 1 - Math.min(0.35, tangentTurn * 0.35)
      : 1
    const width = Math.max(
      0.1,
      options.width
        * cornerWidthFactor
        * (1 + (random() - 0.5) * irregularity * (options.rockLike ? 0.28 : 0.18)),
    )
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
      position: !options.smoothBoundary && cornerPoint && cornerTangents
        ? [cornerPoint[0], 0, cornerPoint[1]]
        : [center[0], 0, center[1]],
      corners,
      length,
      width,
      height,
      colorOffset: [
        (random() - 0.5) * 0.015,
        (random() - 0.5) * 0.08,
        (random() - 0.5) * 0.12,
      ],
      rockSeed: Math.floor(random() * 2147483647),
      rockRotation: (random() - 0.5) * (options.rockLike ? 0 : 0.08),
      tangent,
      cornerPoint: options.smoothBoundary ? undefined : cornerPoint,
      cornerTangents: options.smoothBoundary ? undefined : cornerTangents,
    }
  })
}
