import { cutOverlapCoping } from './overlap-coping'
import type { PoolOverlap } from '../design/pool-overlap'
import { cutPoolSpilloverNotches } from './spillover-notch'
import type { SpilloverNotch } from '../design/spillover-notch'
import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  Path,
  Shape,
  ShapeGeometry,
  ShapeUtils,
  Vector2,
} from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js'
import { color, float, mix, normalLocal, positionLocal, sin, smoothstep, vec2 } from 'three/tsl'
import { getPoolDepthRange, getPoolDepthResolver } from '../design/depth-profile'
import { buildPoolOutlines } from '../design/outlines'
import { PoolNode, type PoolPoint, resolvePoolPolygon } from './schema'
import { PoolWaterEffect } from '../shader/water-effect'
import { buildNaturalCopingGeometry } from '../design/coping'
import { buildSubmergedFeatureCopingGeometry } from '../design/feature-coping'
import { getPoolFinishSettings } from '../design/pool-finishes'

function addPlanarUvAttribute(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position')
  if (!position || position.count === 0) {
    geometry.setAttribute('uv', new Float32BufferAttribute([], 2))
    return geometry
  }
  let minimumX = Number.POSITIVE_INFINITY
  let maximumX = Number.NEGATIVE_INFINITY
  let minimumZ = Number.POSITIVE_INFINITY
  let maximumZ = Number.NEGATIVE_INFINITY
  for (let index = 0; index < position.count; index += 1) {
    minimumX = Math.min(minimumX, position.getX(index))
    maximumX = Math.max(maximumX, position.getX(index))
    minimumZ = Math.min(minimumZ, position.getZ(index))
    maximumZ = Math.max(maximumZ, position.getZ(index))
  }
  const width = Math.max(0.001, maximumX - minimumX)
  const depth = Math.max(0.001, maximumZ - minimumZ)
  const uvs = new Float32Array(position.count * 2)
  for (let index = 0; index < position.count; index += 1) {
    uvs[index * 2] = (position.getX(index) - minimumX) / width
    uvs[index * 2 + 1] = (position.getZ(index) - minimumZ) / depth
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  return geometry
}

function traceShape(points: PoolPoint[]): Shape {
  const shape = new Shape()
  const first = points[0]
  if (!first) return shape
  shape.moveTo(first[0], -first[1])
  for (const [x, z] of points.slice(1)) shape.lineTo(x, -z)
  shape.closePath()
  return shape
}

function traceHole(points: PoolPoint[]): Path {
  const path = new Path()
  const reversed = [...points].reverse()
  const first = reversed[0]
  if (!first) return path
  path.moveTo(first[0], -first[1])
  for (const [x, z] of reversed.slice(1)) path.lineTo(x, -z)
  path.closePath()
  return path
}

function ringShape(outer: PoolPoint[], inner: PoolPoint[]): Shape {
  const shape = traceShape(outer)
  shape.holes.push(traceHole(inner))
  return shape
}

function extrudeVertically(
  shape: Shape,
  height: number,
  baseY: number,
  profile: 'square' | 'bullnose' | 'chamfered' = 'square',
  corner: 'miter' | 'rounded' = 'miter',
) {
  const bevelSize = profile === 'square' ? 0 : Math.min(height * 0.45, profile === 'bullnose' ? 0.04 : 0.025)
  const geometry = new ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: corner === 'rounded' ? 4 : 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: corner === 'rounded' ? 4 : 1,
    depth: height,
    steps: 1,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, baseY, 0)
  geometry.computeVertexNormals()
  return geometry
}

type Point3 = [number, number, number]
type ProfiledPoint = [x: number, z: number, heightAboveFloor: number]

const GEOMETRY_EPSILON = 1e-8

export type PoolGeometryOptions = {
  overlaps?: PoolOverlap[]
  spilloverNotches?: SpilloverNotch[]
  removeWallRegions?: PoolPoint[][]
  removeWallCapRegions?: PoolPoint[][]
  removeFloorRegions?: PoolPoint[][]
  removeWaterRegions?: PoolPoint[][]
}

function pointInPolygon(point: PoolPoint, polygon: PoolPoint[]) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index]!
    const previousPoint = polygon[previous]!
    const edgeX = currentPoint[0] - previousPoint[0]
    const edgeZ = currentPoint[1] - previousPoint[1]
    const pointX = point[0] - previousPoint[0]
    const pointZ = point[1] - previousPoint[1]
    const edgeLengthSquared = edgeX * edgeX + edgeZ * edgeZ
    const cross = edgeX * pointZ - edgeZ * pointX
    const projection = pointX * edgeX + pointZ * edgeZ
    if (Math.abs(cross) <= 1e-7 && projection >= -1e-7 && projection <= edgeLengthSquared + 1e-7) return true
    const crosses = (currentPoint[1] > point[1]) !== (previousPoint[1] > point[1])
    if (crosses && point[0] < (previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1]) / (previousPoint[1] - currentPoint[1]) + currentPoint[0]) {
      inside = !inside
    }
  }
  return inside
}

function pointInAnyPolygon(point: PoolPoint, regions: PoolPoint[][]) {
  return regions.some((region) => pointInPolygon(point, region))
}

type VisibleSegmentFragment = { start: PoolPoint; end: PoolPoint; startT: number; endT: number }

function interpolatePoolPoint(start: PoolPoint, end: PoolPoint, progress: number): PoolPoint {
  return [
    start[0] + (end[0] - start[0]) * progress,
    start[1] + (end[1] - start[1]) * progress,
  ]
}

function visibleSegmentFragments(
  start: PoolPoint,
  end: PoolPoint,
  regions: PoolPoint[][],
  keepInside = false,
): VisibleSegmentFragment[] {
  if (regions.length === 0) return [{ start, end, startT: 0, endT: 1 }]
  const direction: PoolPoint = [end[0] - start[0], end[1] - start[1]]
  const lengthSquared = direction[0] * direction[0] + direction[1] * direction[1]
  if (lengthSquared <= GEOMETRY_EPSILON) return []
  const splitProgress = [0, 1]
  const addProgress = (value: number) => {
    if (value <= GEOMETRY_EPSILON || value >= 1 - GEOMETRY_EPSILON) return
    splitProgress.push(value)
  }
  for (const region of regions) {
    if (region.length < 3) continue
    for (let index = 0; index < region.length; index += 1) {
      const regionStart = region[index]!
      const regionEnd = region[(index + 1) % region.length]!
      const regionDirection: PoolPoint = [
        regionEnd[0] - regionStart[0],
        regionEnd[1] - regionStart[1],
      ]
      const offset: PoolPoint = [regionStart[0] - start[0], regionStart[1] - start[1]]
      const denominator = direction[0] * regionDirection[1] - direction[1] * regionDirection[0]
      if (Math.abs(denominator) <= GEOMETRY_EPSILON) {
        if (Math.abs(offset[0] * direction[1] - offset[1] * direction[0]) > GEOMETRY_EPSILON) continue
        addProgress((offset[0] * direction[0] + offset[1] * direction[1]) / lengthSquared)
        const endOffset: PoolPoint = [regionEnd[0] - start[0], regionEnd[1] - start[1]]
        addProgress((endOffset[0] * direction[0] + endOffset[1] * direction[1]) / lengthSquared)
        continue
      }
      const progress = (offset[0] * regionDirection[1] - offset[1] * regionDirection[0]) / denominator
      const regionProgress = (offset[0] * direction[1] - offset[1] * direction[0]) / denominator
      if (progress >= -GEOMETRY_EPSILON && progress <= 1 + GEOMETRY_EPSILON &&
        regionProgress >= -GEOMETRY_EPSILON && regionProgress <= 1 + GEOMETRY_EPSILON) {
        addProgress(Math.max(0, Math.min(1, progress)))
      }
    }
  }
  splitProgress.sort((left, right) => left - right)
  const uniqueProgress = splitProgress.filter((value, index) =>
    index === 0 || Math.abs(value - splitProgress[index - 1]!) > GEOMETRY_EPSILON,
  )
  const fragments: VisibleSegmentFragment[] = []
  for (let index = 0; index < uniqueProgress.length - 1; index += 1) {
    const startT = uniqueProgress[index]!
    const endT = uniqueProgress[index + 1]!
    if (endT - startT <= GEOMETRY_EPSILON) continue
    const midpoint = interpolatePoolPoint(start, end, (startT + endT) / 2)
    if (pointInAnyPolygon(midpoint, regions) !== keepInside) continue
    fragments.push({
      start: interpolatePoolPoint(start, end, startT),
      end: interpolatePoolPoint(start, end, endT),
      startT,
      endT,
    })
  }
  return fragments
}

function signedArea(points: PoolPoint[]) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]
    return next ? area + point[0] * next[1] - next[0] * point[1] : area
  }, 0) / 2
}

function normalizeClippedPolygon(points: PoolPoint[]) {
  let normalized = points.filter((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length]
    return !previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > GEOMETRY_EPSILON
  })
  let changed = true
  while (changed && normalized.length >= 3) {
    changed = false
    normalized = normalized.filter((point, index) => {
      const previous = normalized[(index - 1 + normalized.length) % normalized.length]!
      const next = normalized[(index + 1) % normalized.length]!
      const cross = (point[0] - previous[0]) * (next[1] - point[1])
        - (point[1] - previous[1]) * (next[0] - point[0])
      if (Math.abs(cross) <= GEOMETRY_EPSILON) changed = true
      return Math.abs(cross) > GEOMETRY_EPSILON
    })
  }
  return normalized
}

function clipAtX(points: PoolPoint[], boundary: number, keepRight: boolean) {
  const clipped: PoolPoint[] = []
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!
    const next = points[(index + 1) % points.length]!
    const currentInside = keepRight
      ? current[0] >= boundary - GEOMETRY_EPSILON
      : current[0] <= boundary + GEOMETRY_EPSILON
    const nextInside = keepRight
      ? next[0] >= boundary - GEOMETRY_EPSILON
      : next[0] <= boundary + GEOMETRY_EPSILON

    if (currentInside !== nextInside) {
      const progress = (boundary - current[0]) / (next[0] - current[0])
      const intersection: PoolPoint = [
        boundary,
        current[1] + (next[1] - current[1]) * progress,
      ]
      if (currentInside) clipped.push(intersection)
      else clipped.push(intersection, next)
    } else if (nextInside) {
      clipped.push(next)
    }
  }
  return clipped
}

function splitConvexPolygonAtCuts(points: PoolPoint[], cuts: number[]) {
  let fragments = [points]
  for (const cut of cuts) {
    fragments = fragments.flatMap((fragment) => [
      clipAtX(fragment, cut, false),
      clipAtX(fragment, cut, true),
    ]).filter((fragment) =>
      fragment.length >= 3 && Math.abs(signedArea(fragment)) > GEOMETRY_EPSILON,
    )
  }
  return fragments
}

function clipProfiledPolygonAtX(
  points: ProfiledPoint[],
  boundary: number,
  keepRight: boolean,
) {
  const clipped: ProfiledPoint[] = []
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!
    const next = points[(index + 1) % points.length]!
    const currentInside = keepRight
      ? current[0] >= boundary - GEOMETRY_EPSILON
      : current[0] <= boundary + GEOMETRY_EPSILON
    const nextInside = keepRight
      ? next[0] >= boundary - GEOMETRY_EPSILON
      : next[0] <= boundary + GEOMETRY_EPSILON

    if (currentInside !== nextInside) {
      const progress = (boundary - current[0]) / (next[0] - current[0])
      const intersection: ProfiledPoint = [
        boundary,
        current[1] + (next[1] - current[1]) * progress,
        current[2] + (next[2] - current[2]) * progress,
      ]
      if (currentInside) clipped.push(intersection)
      else clipped.push(intersection, next)
    } else if (nextInside) {
      clipped.push(next)
    }
  }
  return clipped
}

function splitProfiledTriangleAtCuts(points: ProfiledPoint[], cuts: number[]) {
  let fragments = [points]
  for (const cut of cuts) {
    fragments = fragments.flatMap((fragment) => [
      clipProfiledPolygonAtX(fragment, cut, false),
      clipProfiledPolygonAtX(fragment, cut, true),
    ]).filter((fragment) =>
      fragment.length >= 3 &&
      Math.abs(signedArea(fragment.map(([x, z]) => [x, z]))) > GEOMETRY_EPSILON,
    )
  }
  return fragments
}

function splitBoundaryAtCuts(points: PoolPoint[], cuts: number[]) {
  return points.flatMap((current, index) => {
    const next = points[(index + 1) % points.length]!
    const intersections = cuts
      .map((cut) => ({
        cut,
        progress: (cut - current[0]) / (next[0] - current[0]),
      }))
      .filter(({ progress }) => Number.isFinite(progress) && progress > 0 && progress < 1)
      .sort((left, right) => left.progress - right.progress)
      .map(({ cut, progress }): PoolPoint => [
        cut,
        current[1] + (next[1] - current[1]) * progress,
      ])
    return [current, ...intersections]
  })
}

function clipPolygonAgainstEdge(
  points: PoolPoint[],
  edgeStart: PoolPoint,
  edgeEnd: PoolPoint,
  keepLeft: boolean,
) {
  const clipped: PoolPoint[] = []
  const side = (point: PoolPoint) => (
    edgeEnd[0] - edgeStart[0]
  ) * (point[1] - edgeStart[1]) - (
    edgeEnd[1] - edgeStart[1]
  ) * (point[0] - edgeStart[0])
  const isInside = (point: PoolPoint) => keepLeft
    ? side(point) >= -GEOMETRY_EPSILON
    : side(point) <= GEOMETRY_EPSILON

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!
    const next = points[(index + 1) % points.length]!
    const currentInside = isInside(current)
    const nextInside = isInside(next)
    if (currentInside !== nextInside) {
      const currentSide = side(current)
      const nextSide = side(next)
      const denominator = currentSide - nextSide
      const progress = Math.abs(denominator) > GEOMETRY_EPSILON
        ? currentSide / denominator
        : 0
      clipped.push([
        current[0] + (next[0] - current[0]) * progress,
        current[1] + (next[1] - current[1]) * progress,
      ])
    }
    if (nextInside) clipped.push(next)
  }
  return clipped
}

/** Returns disjoint pieces of a polygon after removing convex overlap regions. */
function subtractConvexRegions(subject: PoolPoint[], regions: PoolPoint[][]) {
  let fragments = [normalizeClippedPolygon(subject)]
  for (const sourceRegion of regions) {
    const region = signedArea(sourceRegion) >= 0 ? sourceRegion : [...sourceRegion].reverse()
    let insideFragments = fragments
    const outsideFragments: PoolPoint[][] = []
    for (let index = 0; index < region.length; index += 1) {
      const edgeStart = region[index]!
      const edgeEnd = region[(index + 1) % region.length]!
      const nextInsideFragments: PoolPoint[][] = []
      for (const fragment of insideFragments) {
        const outside = normalizeClippedPolygon(clipPolygonAgainstEdge(fragment, edgeStart, edgeEnd, false))
        if (outside.length >= 3 && Math.abs(signedArea(outside)) > GEOMETRY_EPSILON) {
          outsideFragments.push(outside)
        }
        const inside = normalizeClippedPolygon(clipPolygonAgainstEdge(fragment, edgeStart, edgeEnd, true))
        if (inside.length >= 3 && Math.abs(signedArea(inside)) > GEOMETRY_EPSILON) {
          nextInsideFragments.push(inside)
        }
      }
      insideFragments = nextInsideFragments
      if (insideFragments.length === 0) break
    }
    fragments = outsideFragments
  }
  return fragments
}

function pushTriangle(positions: number[], first: Point3, second: Point3, third: Point3) {
  positions.push(...first, ...second, ...third)
}

function pushQuad(
  positions: number[],
  first: Point3,
  second: Point3,
  third: Point3,
  fourth: Point3,
) {
  pushTriangle(positions, first, second, third)
  pushTriangle(positions, first, third, fourth)
}

function pushFloorFace(
  positions: number[],
  points: [PoolPoint, PoolPoint, PoolPoint],
  depthAtX: (x: number) => number,
  offset: number,
  faceUp: boolean,
) {
  const [first, second, third] = points
  const area = signedArea(points)
  if (Math.abs(area) <= GEOMETRY_EPSILON) return
  const vertices = [first, second, third].map(([x, z]): Point3 => [
    x,
    -depthAtX(x) - offset,
    z,
  ]) as [Point3, Point3, Point3]
  const reverse = faceUp ? area > 0 : area < 0
  pushTriangle(
    positions,
    vertices[0],
    reverse ? vertices[2] : vertices[1],
    reverse ? vertices[1] : vertices[2],
  )
}

function createPoolFloorGeometry(
  points: PoolPoint[],
  depthAtX: (x: number) => number,
  floorThickness: number,
  cuts: number[],
  removeFloorRegions: PoolPoint[][] = [],
) {
  const positions: number[] = []
  const contour = points.map(([x, z]) => new Vector2(x, z))
  const triangles = ShapeUtils.triangulateShape(contour, [])

  for (const triangleIndices of triangles) {
    const firstIndex = triangleIndices[0]!
    const secondIndex = triangleIndices[1]!
    const thirdIndex = triangleIndices[2]!
    const triangle = [
      points[firstIndex]!,
      points[secondIndex]!,
      points[thirdIndex]!,
    ] as [PoolPoint, PoolPoint, PoolPoint]
    for (const fragment of splitConvexPolygonAtCuts(triangle, cuts)) {
      for (let index = 1; index < fragment.length - 1; index += 1) {
        const face = [fragment[0]!, fragment[index]!, fragment[index + 1]!] as [
          PoolPoint,
          PoolPoint,
          PoolPoint,
        ]
        for (const remaining of subtractConvexRegions(face, removeFloorRegions)) {
          for (let faceIndex = 1; faceIndex < remaining.length - 1; faceIndex += 1) {
            const clippedFace = [remaining[0]!, remaining[faceIndex]!, remaining[faceIndex + 1]!] as [PoolPoint, PoolPoint, PoolPoint]
            pushFloorFace(positions, clippedFace, depthAtX, 0, true)
            pushFloorFace(positions, clippedFace, depthAtX, floorThickness, false)
          }
        }
      }
    }
  }

  const boundary = splitBoundaryAtCuts(points, cuts)
  for (let index = 0; index < boundary.length; index += 1) {
    const current = boundary[index]!
    const next = boundary[(index + 1) % boundary.length]!
    const topCurrent: Point3 = [current[0], -depthAtX(current[0]), current[1]]
    const topNext: Point3 = [next[0], -depthAtX(next[0]), next[1]]
    const bottomCurrent: Point3 = [current[0], topCurrent[1] - floorThickness, current[1]]
    const bottomNext: Point3 = [next[0], topNext[1] - floorThickness, next[1]]
    pushQuad(positions, topCurrent, topNext, bottomNext, bottomCurrent)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  addPlanarUvAttribute(geometry)
  geometry.computeVertexNormals()
  return geometry
}

function createPoolWallGeometry(
  inner: PoolPoint[],
  outer: PoolPoint[],
  depthAtX: (x: number) => number,
  cuts: number[],
  coveRadius: number,
  coveInner: PoolPoint[],
  removeWallRegions: PoolPoint[][] = [],
  removeWallCapRegions: PoolPoint[][] = removeWallRegions,
  closeBottom = false,
) {
  const positions: number[] = []

  const addWallFace = (
    boundary: PoolPoint[],
    reverse: boolean,
    regions: PoolPoint[][],
    bottomOffset = 0,
  ) => {
    const split = splitBoundaryAtCuts(boundary, cuts)
    for (let index = 0; index < split.length; index += 1) {
      for (const fragment of visibleSegmentFragments(split[index]!, split[(index + 1) % split.length]!, regions)) {
        const current = fragment.start
        const next = fragment.end
        const topCurrent: Point3 = [current[0], 0, current[1]]
        const topNext: Point3 = [next[0], 0, next[1]]
        const bottomCurrent: Point3 = [
          current[0],
          -depthAtX(current[0]) + bottomOffset,
          current[1],
        ]
        const bottomNext: Point3 = [
          next[0],
          -depthAtX(next[0]) + bottomOffset,
          next[1],
        ]
        if (reverse) pushQuad(positions, topCurrent, bottomCurrent, bottomNext, topNext)
        else pushQuad(positions, topCurrent, topNext, bottomNext, bottomCurrent)
      }
    }
  }

  addWallFace(inner, false, removeWallRegions, coveRadius)
  const outerStart = positions.length / 3
  addWallFace(outer, true, removeWallCapRegions)
  const outerEnd = positions.length / 3

  if (coveRadius > GEOMETRY_EPSILON) {
    const inset = coveInner
    const radialSegments = 8
    const covePoint = (index: number, nextIndex: number, progress: number, angle: number): ProfiledPoint => {
      const boundary = interpolatePoolPoint(inner[index]!, inner[nextIndex]!, progress)
      const floorEdge = interpolatePoolPoint(inset[index]!, inset[nextIndex]!, progress)
      const horizontal = Math.cos(angle)
      const x = boundary[0] + (floorEdge[0] - boundary[0]) * horizontal
      const z = boundary[1] + (floorEdge[1] - boundary[1]) * horizontal
      return [x, z, coveRadius * Math.sin(angle)]
    }
    const addCoveTriangle = (
      first: ProfiledPoint,
      second: ProfiledPoint,
      third: ProfiledPoint,
    ) => {
      for (const fragment of splitProfiledTriangleAtCuts([first, second, third], cuts)) {
        for (let index = 1; index < fragment.length - 1; index += 1) {
          const vertices = [fragment[0]!, fragment[index]!, fragment[index + 1]!]
            .map(([x, z, heightAboveFloor]): Point3 => [
              x,
              -depthAtX(x) + heightAboveFloor,
              z,
            ])
          pushTriangle(positions, vertices[0]!, vertices[1]!, vertices[2]!)
        }
      }
    }

    for (let index = 0; index < inner.length; index += 1) {
      const nextIndex = (index + 1) % inner.length
      for (const fragment of visibleSegmentFragments(inner[index]!, inner[nextIndex]!, removeWallRegions)) {
        // Clipping a wall also opens the end of its rounded wall-to-floor
        // transition. Close that exposed cross-section down to the floor.
        // The cap shares the cove's sampled arc, depth cuts and tile material.
        for (const [progress, reverse] of [
          ...(fragment.startT > GEOMETRY_EPSILON ? [[fragment.startT, true] as const] : []),
          ...(fragment.endT < 1 - GEOMETRY_EPSILON ? [[fragment.endT, false] as const] : []),
        ]) {
          const boundary = interpolatePoolPoint(inner[index]!, inner[nextIndex]!, progress)
          const floor: ProfiledPoint = [boundary[0], boundary[1], 0]
          for (let segment = 0; segment < radialSegments; segment += 1) {
            const a = covePoint(index, nextIndex, progress, segment / radialSegments * Math.PI / 2)
            const b = covePoint(index, nextIndex, progress, (segment + 1) / radialSegments * Math.PI / 2)
            addCoveTriangle(floor, reverse ? b : a, reverse ? a : b)
          }
        }
        for (let segment = 0; segment < radialSegments; segment += 1) {
          const startAngle = segment / radialSegments * Math.PI / 2
          const endAngle = (segment + 1) / radialSegments * Math.PI / 2
          const first = covePoint(index, nextIndex, fragment.startT, startAngle)
          const second = covePoint(index, nextIndex, fragment.endT, startAngle)
          const third = covePoint(index, nextIndex, fragment.endT, endAngle)
          const fourth = covePoint(index, nextIndex, fragment.startT, endAngle)
          addCoveTriangle(first, second, third)
          addCoveTriangle(first, third, fourth)
        }
      }
    }
  }

  for (let index = 0; index < inner.length; index += 1) {
    const nextIndex = (index + 1) % inner.length
    for (const fragment of visibleSegmentFragments(inner[index]!, inner[nextIndex]!, removeWallCapRegions)) {
      const innerCurrent = fragment.start
      const innerNext = fragment.end
      const outerCurrent = interpolatePoolPoint(outer[index]!, outer[nextIndex]!, fragment.startT)
      const outerNext = interpolatePoolPoint(outer[index]!, outer[nextIndex]!, fragment.endT)
      pushQuad(
        positions,
        [innerCurrent[0], 0, innerCurrent[1]],
        [outerCurrent[0], 0, outerCurrent[1]],
        [outerNext[0], 0, outerNext[1]],
        [innerNext[0], 0, innerNext[1]],
      )
    }
  }

  // Close the underside of the shell so upper-wall boolean cuts produce
  // a solid sill and jambs instead of leaving the wall interior exposed.
  const bottomInner = coveRadius > GEOMETRY_EPSILON ? coveInner : inner
  for (let index = 0; closeBottom && index < inner.length; index += 1) {
    const next = (index + 1) % inner.length
    for (const fragment of visibleSegmentFragments(inner[index]!, inner[next]!, removeWallCapRegions)) {
      const a = interpolatePoolPoint(bottomInner[index]!, bottomInner[next]!, fragment.startT)
      const b = interpolatePoolPoint(bottomInner[index]!, bottomInner[next]!, fragment.endT)
      const c = interpolatePoolPoint(outer[index]!, outer[next]!, fragment.endT)
      const d = interpolatePoolPoint(outer[index]!, outer[next]!, fragment.startT)
      pushQuad(positions,
        [a[0], -depthAtX(a[0]), a[1]],
        [b[0], -depthAtX(b[0]), b[1]],
        [c[0], -depthAtX(c[0]), c[1]],
        [d[0], -depthAtX(d[0]), d[1]],
      )
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const vertexCount = positions.length / 3
  geometry.clearGroups()
  geometry.addGroup(0, outerStart, 0)
  geometry.addGroup(outerStart, outerEnd - outerStart, 1)
  geometry.addGroup(outerEnd, vertexCount - outerEnd, 0)
  addPlanarUvAttribute(geometry)
  geometry.computeVertexNormals()
  return geometry
}

function getCrossSectionIntervals(points: PoolPoint[], x: number) {
  const intersections: number[] = []
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!
    const next = points[(index + 1) % points.length]!
    const crosses = (current[0] <= x && next[0] > x) || (next[0] <= x && current[0] > x)
    if (!crosses) continue
    const progress = (x - current[0]) / (next[0] - current[0])
    intersections.push(current[1] + (next[1] - current[1]) * progress)
  }
  intersections.sort((left, right) => left - right)
  return Array.from({ length: Math.floor(intersections.length / 2) }, (_, index) => [
    intersections[index * 2]!,
    intersections[index * 2 + 1]!,
  ] as const)
}

function addClippedSurface(
  positions: number[],
  points: PoolPoint[],
  minimumX: number,
  maximumX: number,
  depthAtX: (x: number) => number,
) {
  const contour = points.map(([x, z]) => new Vector2(x, z))
  for (const triangleIndices of ShapeUtils.triangulateShape(contour, [])) {
    const triangle = [
      points[triangleIndices[0]!]!,
      points[triangleIndices[1]!]!,
      points[triangleIndices[2]!]!,
    ] as [PoolPoint, PoolPoint, PoolPoint]
    const clipped = clipAtX(clipAtX(triangle, minimumX, true), maximumX, false)
    if (clipped.length < 3 || Math.abs(signedArea(clipped)) <= GEOMETRY_EPSILON) continue
    for (let index = 1; index < clipped.length - 1; index += 1) {
      pushFloorFace(
        positions,
        [clipped[0]!, clipped[index]!, clipped[index + 1]!],
        depthAtX,
        0,
        true,
      )
    }
  }
}

function createEntryStepsGeometry(
  points: PoolPoint[],
  floorDepthAtX: (x: number) => number,
  requestedLength: number,
  requestedTopDepth: number,
  requestedStepCount: number,
) {
  const positions: number[] = []
  const xs = points.map(([x]) => x)
  const minimumX = Math.min(...xs)
  const maximumX = Math.max(...xs)
  const length = Math.min(requestedLength, (maximumX - minimumX) * 0.6)
  const endX = minimumX + length
  const stepCount = Math.max(2, Math.min(6, Math.round(requestedStepCount)))
  const floorDepth = floorDepthAtX(endX)
  const topDepth = Math.min(requestedTopDepth, floorDepth * 0.8)
  const treadDepth = (index: number) =>
    topDepth + (floorDepth - topDepth) * index / stepCount

  for (let step = 0; step < stepCount; step += 1) {
    const startX = minimumX + length * step / stepCount
    const stepEndX = minimumX + length * (step + 1) / stepCount
    const depth = treadDepth(step)
    addClippedSurface(positions, points, startX, stepEndX, () => depth)

    if (step === 0) continue
    const previousDepth = treadDepth(step - 1)
    for (const [minimumZ, maximumZ] of getCrossSectionIntervals(points, startX)) {
      pushQuad(
        positions,
        [startX, -previousDepth, minimumZ],
        [startX, -previousDepth, maximumZ],
        [startX, -depth, maximumZ],
        [startX, -depth, minimumZ],
      )
    }
  }

  const lastDepth = treadDepth(stepCount - 1)
  for (const [minimumZ, maximumZ] of getCrossSectionIntervals(points, endX)) {
    pushQuad(
      positions,
      [endX, -lastDepth, minimumZ],
      [endX, -lastDepth, maximumZ],
      [endX, -floorDepthAtX(endX), maximumZ],
      [endX, -floorDepthAtX(endX), minimumZ],
    )
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  addPlanarUvAttribute(geometry)
  geometry.computeVertexNormals()
  return geometry
}

function createEndPlatformGeometry(
  points: PoolPoint[],
  floorDepthAtX: (x: number) => number,
  minimumX: number,
  maximumX: number,
  requestedTopDepth: number,
  frontX: number,
) {
  const positions: number[] = []
  const topDepth = Math.min(requestedTopDepth, floorDepthAtX(frontX) * 0.8)
  addClippedSurface(positions, points, minimumX, maximumX, () => topDepth)
  for (const [minimumZ, maximumZ] of getCrossSectionIntervals(points, frontX)) {
    pushQuad(
      positions,
      [frontX, -topDepth, minimumZ],
      [frontX, -topDepth, maximumZ],
      [frontX, -floorDepthAtX(frontX), maximumZ],
      [frontX, -floorDepthAtX(frontX), minimumZ],
    )
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  addPlanarUvAttribute(geometry)
  geometry.computeVertexNormals()
  return geometry
}

function createBoundaryBenchGeometry(
  points: PoolPoint[],
  floorDepthAtX: (x: number) => number,
  centerT: number,
  requestedLength: number,
  requestedWidth: number,
  requestedTopDepth: number,
) {
  const positions: number[] = []
  if (points.length < 3) return new BufferGeometry()
  const winding = signedArea(points) >= 0 ? 1 : -1
  const lengths = points.map((point, index) => {
    const next = points[(index + 1) % points.length]!
    return Math.hypot(next[0] - point[0], next[1] - point[1])
  })
  const perimeter = lengths.reduce((sum, length) => sum + length, 0)
  const width = Math.max(0.05, requestedWidth)
  const length = Math.min(Math.max(0.5, requestedLength), perimeter * 0.8)
  const sampleCount = Math.max(4, Math.ceil(length / 0.18))
  const pointAt = (distance: number): { point: PoolPoint; tangent: PoolPoint } => {
    let remaining = ((distance % perimeter) + perimeter) % perimeter
    for (let index = 0; index < points.length; index += 1) {
      const edgeLength = lengths[index]!
      if (remaining <= edgeLength || index === points.length - 1) {
        const start = points[index]!
        const end = points[(index + 1) % points.length]!
        const progress = edgeLength <= 0.001 ? 0 : remaining / edgeLength
        return {
          point: [start[0] + (end[0] - start[0]) * progress, start[1] + (end[1] - start[1]) * progress],
          tangent: [(end[0] - start[0]) / Math.max(edgeLength, 0.001), (end[1] - start[1]) / Math.max(edgeLength, 0.001)],
        }
      }
      remaining -= edgeLength
    }
    return { point: points[0]!, tangent: [1, 0] }
  }
  const samples = Array.from({ length: sampleCount + 1 }, (_, index) => {
    const sample = pointAt(perimeter * centerT - length / 2 + length * index / sampleCount)
    const inward: PoolPoint = winding > 0 ? [-sample.tangent[1], sample.tangent[0]] : [sample.tangent[1], -sample.tangent[0]]
    const inner: PoolPoint = [sample.point[0] + inward[0] * width, sample.point[1] + inward[1] * width]
    const topDepth = Math.min(requestedTopDepth, floorDepthAtX(inner[0]) * 0.8)
    return { point: sample.point, inner, topDepth, floorDepth: floorDepthAtX(inner[0]) }
  })
  for (let index = 0; index < samples.length - 1; index += 1) {
    const current = samples[index]!
    const next = samples[index + 1]!
    // Flat top strip following the selected boundary.
    pushQuad(positions,
      [current.point[0], -current.topDepth, current.point[1]],
      [next.point[0], -next.topDepth, next.point[1]],
      [next.inner[0], -next.topDepth, next.inner[1]],
      [current.inner[0], -current.topDepth, current.inner[1]],
    )
    // Vertical front face down to the pool floor.
    pushQuad(positions,
      [current.inner[0], -current.topDepth, current.inner[1]],
      [next.inner[0], -next.topDepth, next.inner[1]],
      [next.inner[0], -next.floorDepth, next.inner[1]],
      [current.inner[0], -current.floorDepth, current.inner[1]],
    )
  }
  // Close both short ends of the bench. Without these caps, the boundary
  // strip and front face leave an exposed triangular side gap on curved and
  // freeform pools.
  for (const sample of [samples[0]!, samples[samples.length - 1]!]) {
    const boundaryFloorDepth = floorDepthAtX(sample.point[0])
    pushQuad(positions,
      [sample.point[0], -sample.topDepth, sample.point[1]],
      [sample.inner[0], -sample.topDepth, sample.inner[1]],
      [sample.inner[0], -sample.floorDepth, sample.inner[1]],
      [sample.point[0], -boundaryFloorDepth, sample.point[1]],
    )
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  addPlanarUvAttribute(geometry)
  geometry.computeVertexNormals()
  return geometry
}

function boundaryPositionForLegacyWall(points: PoolPoint[], wall: PoolNode['benchWall']) {
  const perimeter = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!
    return sum + Math.hypot(next[0] - point[0], next[1] - point[1])
  }, 0)
  let distance = 0
  let bestT = 0
  let bestScore = Number.POSITIVE_INFINITY
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]!
    const end = points[(index + 1) % points.length]!
    const edgeLength = Math.hypot(end[0] - start[0], end[1] - start[1])
    const midpoint: PoolPoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
    const score = wall === 'min-x' ? midpoint[0]
      : wall === 'max-x' ? -midpoint[0]
        : wall === 'min-z' ? midpoint[1]
          : -midpoint[1]
    if (score < bestScore) { bestScore = score; bestT = (distance + edgeLength / 2) / perimeter }
    distance += edgeLength
  }
  return bestT
}

function createPerimeterBenchGeometry(
  points: PoolPoint[],
  floorDepthAtX: (x: number) => number,
  requestedWidth: number,
  requestedTopDepth: number,
) {
  const positions: number[] = []
  if (points.length < 3) return new BufferGeometry()
  const winding = signedArea(points) >= 0 ? 1 : -1
  const width = Math.max(0.05, requestedWidth)
  const insetPoints = points.map((point, index) => {
    const next = points[(index + 1) % points.length]!
    const edgeLength = Math.hypot(next[0] - point[0], next[1] - point[1])
    if (edgeLength <= GEOMETRY_EPSILON) return [...point] as PoolPoint
    const tangent: PoolPoint = [(next[0] - point[0]) / edgeLength, (next[1] - point[1]) / edgeLength]
    const inward: PoolPoint = winding > 0 ? [-tangent[1], tangent[0]] : [tangent[1], -tangent[0]]
    return [point[0] + inward[0] * width, point[1] + inward[1] * width] as PoolPoint
  })

  for (let index = 0; index < points.length; index += 1) {
    const nextIndex = (index + 1) % points.length
    const boundaryStart = points[index]!
    const boundaryEnd = points[nextIndex]!
    const insetStart = insetPoints[index]!
    const insetEnd = insetPoints[nextIndex]!
    const midpointX = (boundaryStart[0] + boundaryEnd[0]) / 2
    const topDepth = Math.min(requestedTopDepth, floorDepthAtX(midpointX) * 0.8)
    const startDepth = Math.max(topDepth, floorDepthAtX(insetStart[0]))
    const endDepth = Math.max(topDepth, floorDepthAtX(insetEnd[0]))

    pushQuad(
      positions,
      [boundaryStart[0], -topDepth, boundaryStart[1]],
      [boundaryEnd[0], -topDepth, boundaryEnd[1]],
      [insetEnd[0], -topDepth, insetEnd[1]],
      [insetStart[0], -topDepth, insetStart[1]],
    )
    pushQuad(
      positions,
      [insetStart[0], -topDepth, insetStart[1]],
      [insetEnd[0], -topDepth, insetEnd[1]],
      [insetEnd[0], -endDepth, insetEnd[1]],
      [insetStart[0], -startDepth, insetStart[1]],
    )

    // Close the outside of the perimeter bench as well. Without this fascia
    // the bench top is only a single visible plane and reads as a floating
    // slab. The boundary edge is coincident with the basin wall, so the lower
    // edge follows the real floor profile instead of using a fixed thickness.
    const boundaryStartDepth = Math.max(topDepth, floorDepthAtX(boundaryStart[0]))
    const boundaryEndDepth = Math.max(topDepth, floorDepthAtX(boundaryEnd[0]))
    pushQuad(
      positions,
      [boundaryEnd[0], -topDepth, boundaryEnd[1]],
      [boundaryStart[0], -topDepth, boundaryStart[1]],
      [boundaryStart[0], -boundaryStartDepth, boundaryStart[1]],
      [boundaryEnd[0], -boundaryEndDepth, boundaryEnd[1]],
    )
  }

  // Close the small mitred gaps where two offset edge strips meet. This is
  // intentionally a flat corner fill, which also works for freeform outlines.
  for (let index = 0; index < points.length; index += 1) {
    const previousIndex = (index - 1 + points.length) % points.length
    const point = points[index]!
    const currentInset = insetPoints[index]!
    const previousInset = insetPoints[previousIndex]!
    const topDepth = Math.min(requestedTopDepth, floorDepthAtX(point[0]) * 0.8)
    pushTriangle(
      positions,
      [point[0], -topDepth, point[1]],
      [currentInset[0], -topDepth, currentInset[1]],
      [previousInset[0], -topDepth, previousInset[1]],
    )
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  addPlanarUvAttribute(geometry)
  geometry.computeVertexNormals()
  return geometry
}

function createBeachEntryGeometry(
  points: PoolPoint[],
  floorDepthAtX: (x: number) => number,
  minimumX: number,
  maximumX: number,
) {
  const positions: number[] = []
  const length = Math.max(maximumX - minimumX, GEOMETRY_EPSILON)
  const endDepth = floorDepthAtX(maximumX)
  addClippedSurface(
    positions,
    points,
    minimumX,
    maximumX,
    (x) => endDepth * Math.max(0, Math.min(1, (x - minimumX) / length)),
  )
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  addPlanarUvAttribute(geometry)
  geometry.computeVertexNormals()
  return geometry
}

function createWaterGeometry(points: PoolPoint[], removeWaterRegions: PoolPoint[][] = []) {
  const xs = points.map(([x]) => x)
  const zs = points.map(([, z]) => z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const span = Math.max(maxX - minX, maxZ - minZ)
  const maxEdge = Math.max(0.06, span / 96)
  const sourceGeometry = new TessellateModifier(maxEdge, 8).modify(
    new ShapeGeometry(traceShape(points)),
  )
  sourceGeometry.rotateX(-Math.PI / 2)
  const sourcePositions = sourceGeometry.getAttribute('position')
  const geometry = removeWaterRegions.length > 0 ? new BufferGeometry() : sourceGeometry
  if (removeWaterRegions.length > 0) {
    const kept: number[] = []
    for (let index = 0; index < sourcePositions.count; index += 3) {
      const triangle: [PoolPoint, PoolPoint, PoolPoint] = [0, 1, 2].map((vertex) => [
        sourcePositions.getX(index + vertex),
        sourcePositions.getZ(index + vertex),
      ]) as [PoolPoint, PoolPoint, PoolPoint]
      for (const remaining of subtractConvexRegions(triangle, removeWaterRegions)) {
        for (let faceIndex = 1; faceIndex < remaining.length - 1; faceIndex += 1) {
          const face = [remaining[0]!, remaining[faceIndex]!, remaining[faceIndex + 1]!] as [PoolPoint, PoolPoint, PoolPoint]
          if (Math.abs(signedArea(face)) <= GEOMETRY_EPSILON) continue
          for (const vertex of face) {
            kept.push(vertex[0], sourcePositions.getY(index), vertex[1])
          }
        }
      }
    }
    geometry.setAttribute('position', new Float32BufferAttribute(kept, 3))
    sourceGeometry.dispose()
  }
  const positions = geometry.getAttribute('position')
  const uvs = new Float32Array(positions.count * 2)
  const width = Math.max(0.001, maxX - minX)
  const height = Math.max(0.001, maxZ - minZ)
  for (let index = 0; index < positions.count; index += 1) {
    uvs[index * 2] = (positions.getX(index) - minX) / width
    uvs[index * 2 + 1] = (positions.getZ(index) - minZ) / height
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}

function createTileMaterial(node: PoolNode, effect: PoolWaterEffect, points: PoolPoint[]) {
  const finish = getPoolFinishSettings(node.interiorFinish)
  const material = new MeshBasicNodeMaterial({ color: finish.base, side: DoubleSide })
  const normal = normalLocal.abs()
  const isFloor = normal.y.greaterThan(0.65)
  const wallU = normal.x.greaterThan(normal.z).select(positionLocal.z, positionLocal.x)
  const sourceU = isFloor.select(positionLocal.x, wallU)
  const sourceV = isFloor.select(positionLocal.z, positionLocal.y)

  const base = color(finish.base)
  const accent = color(finish.accent)
  const highlight = color(finish.highlight)
  // TSL's `mix` returns a vec3 for color nodes, while the generic helper
  // signature is inferred as vec4 in this version of Three.js. Keep the
  // intermediate shader node un-narrowed so each finish branch can compose
  // its color naturally.
  let surface: any = base

  if (finish.kind === 'mosaic') {
    // 25 cm square ceramic tiles. The small fixed warp keeps the grid from
    // reading like graph paper while preserving clean grout through corners.
    const tileU = sourceU.mul(finish.scale).add(sin(sourceV.mul(2.8)).mul(0.035))
    const tileV = sourceV.mul(finish.scale).add(sin(sourceU.mul(2.4)).mul(0.035))
    const cellU = tileU.floor()
    const cellV = tileV.floor()
    const withinU = tileU.fract()
    const withinV = tileV.fract()
    const edgeU = withinU.min(float(1).sub(withinU))
    const edgeV = withinV.min(float(1).sub(withinV))
    const tileMask = smoothstep(0.035, 0.07, edgeU.min(edgeV))
    const variation = sin(cellU.mul(12.9898).add(cellV.mul(78.233))).mul(43758.5453).fract()
    const tiles = mix(accent, highlight, variation)
    surface = mix(color(finish.grout), tiles, tileMask) as unknown as typeof surface
  } else if (finish.kind !== 'solid') {
    const grain = sin(sourceU.mul(finish.scale * 1.7))
      .add(sin(sourceV.mul(finish.scale * 2.1)))
      .mul(0.25)
      .add(0.5)
    const speckle = sin(
      sourceU.mul(finish.scale * 17.13).add(sourceV.mul(finish.scale * 23.71)),
    ).mul(43758.5453).fract()
    const threshold = finish.kind === 'pebble' ? 0.68 : 0.78
    const size = finish.kind === 'pebble' ? 0.14 : 0.07
    const aggregate = smoothstep(threshold, threshold + size, speckle)
    const blended = mix(base, accent, aggregate.mul(finish.contrast))
    surface = mix(blended, highlight, grain.mul(0.08)) as unknown as typeof surface
    if (finish.sparkle > 0) {
      const sparkle = smoothstep(0.93, 0.985, speckle).mul(finish.sparkle)
      surface = surface.add(highlight.mul(sparkle))
    }
  }
  const xs = points.map(([x]) => x)
  const zs = points.map(([, z]) => z)
  const poolUv = positionLocal.xz.sub(vec2(Math.min(...xs), Math.min(...zs)))
    .div(vec2(
      Math.max(0.001, Math.max(...xs) - Math.min(...xs)),
      Math.max(0.001, Math.max(...zs) - Math.min(...zs)),
    ))
    .clamp(0, 1)
  const underwater = smoothstep(0.04, 0.35, positionLocal.y.negate())
  const caustic = effect.causticsAt(poolUv).mul(underwater).mul(0.5)
  material.colorNode = surface.add(caustic)
  return material
}

export function buildPoolGeometry(nodeInput: PoolNode, options: PoolGeometryOptions = {}): Group {
  // Plugin renderers can receive stored scene data before the registry has
  // materialized defaults added by a newer schema version. Normalize once at
  // this boundary so every downstream dimension is finite.
  const node = PoolNode.parse(nodeInput)
  const overlapRegions = options.overlaps?.filter(overlap => overlap.trimBasin !== false).flatMap(overlap => overlap.regions) ?? []
  const overlapWallRegions = options.overlaps
    ?.filter(overlap => overlap.trimBasin !== false)
    .flatMap(overlap => overlap.wallRegions ?? overlap.regions) ?? []
  const overlapWallCapRegions = options.overlaps
    ?.filter(overlap => overlap.trimBasin !== false)
    .flatMap(overlap => overlap.wallCapRegions ?? overlap.wallRegions ?? overlap.regions) ?? []
  const overlapWaterRegions = options.overlaps
    ?.filter(overlap => overlap.trimBasin !== false && overlap.preserveWater !== true)
    .flatMap(overlap => overlap.regions) ?? []
  options = {
    ...options,
    removeWallRegions: [...(options.removeWallRegions ?? []), ...overlapWallRegions],
    removeWallCapRegions: [...(options.removeWallCapRegions ?? []), ...overlapWallCapRegions],
    removeFloorRegions: [...(options.removeFloorRegions ?? []), ...overlapRegions],
    removeWaterRegions: [...(options.removeWaterRegions ?? []), ...overlapWaterRegions],
  }
  const group = new Group()
  group.name = 'pool-assembly'
  group.position.y = node.finishedDeckElevation

  const sourceOutline = resolvePoolPolygon(node)
  const safeCoveRadius = Math.min(node.coveRadius, getPoolDepthRange(node).minimum * 0.45)
  const outlines = buildPoolOutlines(sourceOutline, {
    shellThickness: node.shellThickness,
    copingWidth: node.copingWidth,
    coveRadius: safeCoveRadius,
    openingClearance: node.openingClearance,
  })
  const inner = outlines.basin
  const waterElevation = node.designWaterElevation
  const shellOuter = outlines.shellOuter
  const copingOuter = outlines.copingOuter
  const waterEffect = new PoolWaterEffect(node)
  const shellMaterial = createTileMaterial(node, waterEffect, inner)
  const outerWallMaterial = new MeshBasicNodeMaterial({ color: '#ffffff', side: DoubleSide })
  const copingMaterial = new MeshBasicNodeMaterial({ color: node.copingColor, side: DoubleSide })
  const depth = getPoolDepthResolver(node, inner)
  const cuts = depth.profile.kind === 'shallow-to-deep'
    ? [
        depth.minimumX + (depth.maximumX - depth.minimumX) * depth.profile.slopeStart / 100,
        depth.minimumX + (depth.maximumX - depth.minimumX) * depth.profile.slopeEnd / 100,
      ]
    : []
  const addSubmergedFeatureEdge = (
    start: PoolPoint,
    end: PoolPoint,
    topDepth: number,
    seed: number,
  ) => {
    if (node.copingStyle !== 'rock') return
    group.add(buildSubmergedFeatureCopingGeometry(start, end, {
      width: node.copingWidth,
      thickness: node.copingThickness,
      stoneLength: node.copingStoneLength,
      irregularity: node.copingIrregularity,
      seed,
      color: node.copingColor,
      topDepth,
    }))
  }

  const floor = new Mesh(
    createPoolFloorGeometry(inner, depth.depthAtX, node.floorThickness, cuts, options.removeFloorRegions),
    shellMaterial,
  )
  floor.name = 'pool-shell-floor'
  group.add(floor)

  const walls = new Mesh(
    createPoolWallGeometry(
      inner,
      shellOuter,
      depth.depthAtX,
      cuts,
      safeCoveRadius,
      outlines.coveInner,
      options.removeWallRegions,
      options.removeWallCapRegions,
      (options.spilloverNotches?.length ?? 0) > 0,
    ),
    [shellMaterial, outerWallMaterial],
  )
  walls.name = 'pool-shell-walls'
  group.add(walls)

  if (node.entryFeature === 'steps') {
    const steps = new Mesh(
      createEntryStepsGeometry(
        inner,
        depth.depthAtX,
        node.entryLength,
        node.entryWaterDepth,
        node.stepCount,
      ),
      shellMaterial,
    )
    steps.name = 'pool-entry-steps'
    group.add(steps)
  } else if (node.entryFeature === 'tanning-shelf') {
    const length = Math.min(node.entryLength, (depth.maximumX - depth.minimumX) * 0.6)
    const endX = depth.minimumX + length
    const shelf = new Mesh(
      createEndPlatformGeometry(
        inner,
        depth.depthAtX,
        depth.minimumX,
        endX,
        node.entryWaterDepth,
        endX,
      ),
      shellMaterial,
    )
    shelf.name = 'pool-entry-tanning-shelf'
    group.add(shelf)
    const shelfIntervals = getCrossSectionIntervals(inner, endX)
    for (const [minimumZ, maximumZ] of shelfIntervals) {
      addSubmergedFeatureEdge([endX, minimumZ], [endX, maximumZ], node.entryWaterDepth, node.copingSeed + 101)
      addSubmergedFeatureEdge([depth.minimumX, minimumZ], [endX, minimumZ], node.entryWaterDepth, node.copingSeed + 102)
      addSubmergedFeatureEdge([depth.minimumX, maximumZ], [endX, maximumZ], node.entryWaterDepth, node.copingSeed + 103)
    }
  } else if (node.entryFeature === 'beach-entry') {
    const length = Math.min(node.entryLength, (depth.maximumX - depth.minimumX) * 0.6)
    const beach = new Mesh(
      createBeachEntryGeometry(
        inner,
        depth.depthAtX,
        depth.minimumX,
        depth.minimumX + length,
      ),
      shellMaterial,
    )
    beach.name = 'pool-entry-beach'
    group.add(beach)
  }

  if (node.benchEnabled) {
    const perimeter = node.benchStyle === 'perimeter'
    const width = Math.min(node.benchWidth, Math.min(node.length, node.width) * 0.3)
    const startX = depth.maximumX - width
    const benchAssembly = new Group()
    const boundaryT = Object.prototype.hasOwnProperty.call(nodeInput, 'benchBoundaryT')
      ? node.benchBoundaryT
      : boundaryPositionForLegacyWall(inner, node.benchWall)
    const bench = new Mesh(
      perimeter
        ? createPerimeterBenchGeometry(inner, depth.depthAtX, width, node.benchWaterDepth)
        : createBoundaryBenchGeometry(inner, depth.depthAtX, boundaryT, node.benchLength, width, node.benchWaterDepth),
      shellMaterial,
    )
    bench.name = 'pool-bench'
    benchAssembly.add(bench)
    group.add(benchAssembly)
    if (node.copingStyle === 'rock') {
      if (perimeter) {
        for (let index = 0; index < inner.length; index += 1) {
          addSubmergedFeatureEdge(inner[index]!, inner[(index + 1) % inner.length]!, node.benchWaterDepth, node.copingSeed + 202 + index)
        }
      } else {
        // The end bench follows the selected boundary; its coping is generated
        // by the same continuous perimeter mode when a natural edge is needed.
      }
    }
  }

  const water = new Mesh(createWaterGeometry(inner, options.removeWaterRegions), waterEffect.material)
  water.name = 'pool-water'
  water.position.y = waterElevation - node.finishedDeckElevation
  water.renderOrder = 1
  // Water is purely visual and must never block picking or placement rays.
  // Leave the animated surface rendered while allowing tools to hit the
  // actual pool shell/floor beneath it.
  water.raycast = () => undefined
  group.add(water)

  if (node.copingStyle === 'natural-stone' || node.copingStyle === 'rock') {
    const coping = buildNaturalCopingGeometry(inner, {
      width: Math.max(node.copingWidth, node.shellThickness + 0.03),
      thickness: node.copingThickness,
      stoneLength: node.copingStoneLength,
      jointWidth: node.copingStyle === 'rock' ? Math.min(node.copingJointWidth, 0.008) : node.copingJointWidth,
      irregularity: node.copingStyle === 'rock' ? Math.max(node.copingIrregularity, 0.75) : node.copingIrregularity,
      seed: node.copingSeed,
      rockLike: node.copingStyle === 'rock',
      smoothBoundary: node.shape === 'spline'
        || node.shape === 'kidney'
        || node.shape === 'lagoon'
        || node.shape === 'roman',
      color: node.copingColor,
    })
    group.add(coping)
    copingMaterial.dispose()
  } else {
    const coping = new Mesh(
      extrudeVertically(
        ringShape(copingOuter, inner),
        node.copingThickness,
        0,
        node.copingProfile,
        node.copingCorner,
      ),
      copingMaterial,
    )
    coping.name = 'pool-coping'
    group.add(coping)
  }

  if (options.overlaps?.length) {
    const positions: number[] = []
    for (const overlap of options.overlaps.filter(item => item.trimBasin !== false && item.suppressSeparator !== true)) {
      for (let index = 0; index < overlap.footprint.length; index++) {
        const next = (index + 1) % overlap.footprint.length
        const a = overlap.footprint[index]!
        const b = overlap.footprint[next]!
        for (const fragment of visibleSegmentFragments(a,b,[inner],true)) {
          const startTop = overlap.topHeights[index]! + (overlap.topHeights[next]!-overlap.topHeights[index]!)*fragment.startT
          const endTop = overlap.topHeights[index]! + (overlap.topHeights[next]!-overlap.topHeights[index]!)*fragment.endT
          const [sx,sz] = fragment.start
          const [ex,ez] = fragment.end
          const startBottom = -depth.depthAtX(sx)-node.floorThickness
          const endBottom = -depth.depthAtX(ex)-node.floorThickness
          if (startTop <= startBottom && endTop <= endBottom) continue
          pushQuad(positions,[sx,Math.max(startBottom,startTop),sz],[ex,Math.max(endBottom,endTop),ez],
            [ex,endBottom,ez],[sx,startBottom,sz])
        }
      }
    }
    if (positions.length) {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
      addPlanarUvAttribute(geometry)
      geometry.computeVertexNormals()
      const wall = new Mesh(geometry,shellMaterial)
      wall.name = 'pool-overlap-separating-wall'
      group.add(wall)
    }
    cutOverlapCoping(group,options.overlaps)


  }

  cutPoolSpilloverNotches(group, options.spilloverNotches ?? [], signedArea(inner) > 0)
  group.userData.waterEffect = waterEffect
  group.userData.outlineWarnings = outlines.warnings

  return group
}
