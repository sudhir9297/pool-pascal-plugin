export type PipePoint = [number, number, number]

/** Common molded PVC elbow angles from the fitting catalog. */
export const PVC_ELBOW_ANGLES_DEGREES = [11.25, 15, 22.5, 30, 45, 60, 90] as const

function horizontalDirections(): PipePoint[] {
  const directions: PipePoint[] = []
  const seen = new Set<string>()
  for (const angle of PVC_ELBOW_ANGLES_DEGREES) {
    // Include every plan orientation and its reverse. This lets a pipe run
    // in any direction while keeping its heading on a supported angle.
    for (let quarterTurn = 0; quarterTurn < 4; quarterTurn += 1) {
      const radians = (angle * Math.PI) / 180 + quarterTurn * Math.PI / 2
      const direction: PipePoint = [Math.cos(radians), 0, Math.sin(radians)]
      const key = direction.map((value) => Math.round(value * 1e6)).join(',')
      if (seen.has(key)) continue
      seen.add(key)
      directions.push(direction)
    }
  }
  return directions
}

const HORIZONTAL_DIRECTIONS: readonly PipePoint[] = horizontalDirections()

const THREE_DIRECTIONS: readonly PipePoint[] = [
  ...HORIZONTAL_DIRECTIONS,
  [0, 1, 0], [0, -1, 0],
  [Math.SQRT1_2, Math.SQRT1_2, 0], [Math.SQRT1_2, -Math.SQRT1_2, 0],
  [-Math.SQRT1_2, Math.SQRT1_2, 0], [-Math.SQRT1_2, -Math.SQRT1_2, 0],
  [Math.SQRT1_2, 0, Math.SQRT1_2], [Math.SQRT1_2, 0, -Math.SQRT1_2],
  [-Math.SQRT1_2, 0, Math.SQRT1_2], [-Math.SQRT1_2, 0, -Math.SQRT1_2],
  [0, Math.SQRT1_2, Math.SQRT1_2], [0, Math.SQRT1_2, -Math.SQRT1_2],
  [0, -Math.SQRT1_2, Math.SQRT1_2], [0, -Math.SQRT1_2, -Math.SQRT1_2],
]

export const PIPE_DIRECTION_CANDIDATES = THREE_DIRECTIONS

/**
 * Projects a cursor position onto the horizontal direction that best matches
 * the cursor's world-space movement from the active pipe point. The camera is
 * only involved in producing the cursor world point; the resulting pipe stays
 * locked to a level axis or a 45-degree diagonal.
 */
export function snapPipePointToDirection(start: PipePoint, cursor: PipePoint, gridStep = 0): PipePoint {
  const deltaX = cursor[0] - start[0]
  const deltaZ = cursor[2] - start[2]
  const distance = Math.hypot(deltaX, deltaZ)
  if (distance <= Number.EPSILON) return [...cursor]

  const cursorDirection = [deltaX / distance, deltaZ / distance] as const
  let best = HORIZONTAL_DIRECTIONS[0]!
  let bestScore = -Infinity
  for (const direction of HORIZONTAL_DIRECTIONS) {
    const score = cursorDirection[0] * direction[0] + cursorDirection[1] * direction[2]
    if (score > bestScore) {
      best = direction
      bestScore = score
    }
  }

  const snappedDistance = gridStep > Number.EPSILON
    ? Math.max(gridStep, Math.round(distance / gridStep) * gridStep)
    : distance
  return [
    start[0] + best[0] * snappedDistance,
    start[1],
    start[2] + best[2] * snappedDistance,
  ]
}

/**
 * Chooses the direction whose 3D line is closest to the camera ray. This is
 * the camera-aware part of PipeIt's drawing behavior: the camera determines
 * what the cursor is aiming at, but the resulting pipe is still constrained
 * to a valid axis or 45-degree direction.
 */
export function snapPipePointToRay(
  start: PipePoint,
  rayOrigin: PipePoint,
  rayDirection: PipePoint,
  gridStep = 0,
): PipePoint {
  const rayLength = Math.hypot(...rayDirection)
  if (rayLength <= Number.EPSILON) return [...start]
  const ray = rayDirection.map((value) => value / rayLength) as PipePoint
  const offset: PipePoint = [rayOrigin[0] - start[0], rayOrigin[1] - start[1], rayOrigin[2] - start[2]]
  let best = THREE_DIRECTIONS[0]!
  let bestParameter = 0
  let bestDistance = Infinity

  for (const direction of THREE_DIRECTIONS) {
    const parallel = direction[0] * ray[0] + direction[1] * ray[1] + direction[2] * ray[2]
    const alongDirection = direction[0] * offset[0] + direction[1] * offset[1] + direction[2] * offset[2]
    const alongRay = ray[0] * offset[0] + ray[1] * offset[1] + ray[2] * offset[2]
    const denominator = 1 - parallel * parallel
    const parameter = Math.max(0, Math.abs(denominator) > 1e-6
      ? (alongDirection - parallel * alongRay) / denominator
      : alongDirection)
    const rayParameter = Math.max(0, parallel * parameter - alongRay)
    const pointOnPipe: PipePoint = [
      start[0] + direction[0] * parameter,
      start[1] + direction[1] * parameter,
      start[2] + direction[2] * parameter,
    ]
    const pointOnRay: PipePoint = [
      rayOrigin[0] + ray[0] * rayParameter,
      rayOrigin[1] + ray[1] * rayParameter,
      rayOrigin[2] + ray[2] * rayParameter,
    ]
    const distance = Math.hypot(
      pointOnPipe[0] - pointOnRay[0],
      pointOnPipe[1] - pointOnRay[1],
      pointOnPipe[2] - pointOnRay[2],
    )
    if (distance < bestDistance) {
      best = direction
      bestParameter = parameter
      bestDistance = distance
    }
  }

  const snappedParameter = gridStep > Number.EPSILON
    ? Math.max(gridStep, Math.round(bestParameter / gridStep) * gridStep)
    : bestParameter
  return [
    start[0] + best[0] * snappedParameter,
    start[1] + best[1] * snappedParameter,
    start[2] + best[2] * snappedParameter,
  ]
}
