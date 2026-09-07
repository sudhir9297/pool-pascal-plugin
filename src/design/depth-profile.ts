import type { PoolPoint } from '../core/schema-primitives'
export { POOL_FLOOR_PROFILES, type PoolFloorProfile } from '../core/pool-options'

type PoolDepthSource = {
  floorProfile?: unknown
  depth?: unknown
  shallowDepth?: unknown
  deepDepth?: unknown
  slopeStart?: unknown
  slopeEnd?: unknown
}

export type ResolvedPoolDepthProfile =
  | { kind: 'flat'; depth: number }
  | {
      kind: 'shallow-to-deep'
      shallowDepth: number
      deepDepth: number
      slopeStart: number
      slopeEnd: number
    }

const MINIMUM_DEPTH = 0.5

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function resolvePoolDepthProfile(source: PoolDepthSource): ResolvedPoolDepthProfile {
  const depth = Math.max(MINIMUM_DEPTH, finiteNumber(source.depth, 1.5))
  if (source.floorProfile !== 'shallow-to-deep') return { kind: 'flat', depth }

  const shallowDepth = Math.max(
    MINIMUM_DEPTH,
    finiteNumber(source.shallowDepth, 1.1),
  )
  const deepDepth = Math.max(
    shallowDepth,
    finiteNumber(source.deepDepth, 2),
  )
  const slopeStart = clamp(finiteNumber(source.slopeStart, 35), 0, 100)
  const slopeEnd = Math.max(
    slopeStart,
    clamp(finiteNumber(source.slopeEnd, 70), 0, 100),
  )

  return { kind: 'shallow-to-deep', shallowDepth, deepDepth, slopeStart, slopeEnd }
}

function getPoolDepthAtX(
  profile: ResolvedPoolDepthProfile,
  x: number,
  minimumX: number,
  maximumX: number,
) {
  if (profile.kind === 'flat') return profile.depth

  const span = maximumX - minimumX
  const station = span > 0 ? clamp((x - minimumX) / span, 0, 1) * 100 : 0
  if (station <= profile.slopeStart) return profile.shallowDepth
  if (station >= profile.slopeEnd) return profile.deepDepth
  if (profile.slopeEnd === profile.slopeStart) return profile.deepDepth

  const progress = (station - profile.slopeStart) / (profile.slopeEnd - profile.slopeStart)
  return profile.shallowDepth + (profile.deepDepth - profile.shallowDepth) * progress
}

export function getPoolDepthRange(source: PoolDepthSource) {
  const profile = resolvePoolDepthProfile(source)
  return profile.kind === 'flat'
    ? { minimum: profile.depth, maximum: profile.depth }
    : { minimum: profile.shallowDepth, maximum: profile.deepDepth }
}

export function getPoolDepthResolver(source: PoolDepthSource, polygon: PoolPoint[]) {
  const xs = polygon.map(([x]) => x)
  const minimumX = Math.min(...xs)
  const maximumX = Math.max(...xs)
  const profile = resolvePoolDepthProfile(source)
  return {
    profile,
    minimumX,
    maximumX,
    depthAtX: (x: number) => getPoolDepthAtX(profile, x, minimumX, maximumX),
  }
}
