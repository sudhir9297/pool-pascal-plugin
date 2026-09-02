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

function signedArea(points: PoolPoint[]) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length]
    return next ? area + point[0] * next[1] - next[0] * point[1] : area
  }, 0) / 2
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
        pushFloorFace(positions, face, depthAtX, 0, true)
        pushFloorFace(positions, face, depthAtX, floorThickness, false)
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
) {
  const positions: number[] = []

  const addWallFace = (boundary: PoolPoint[], reverse: boolean, bottomOffset = 0) => {
    const split = splitBoundaryAtCuts(boundary, cuts)
    for (let index = 0; index < split.length; index += 1) {
      const current = split[index]!
      const next = split[(index + 1) % split.length]!
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

  addWallFace(inner, false, coveRadius)
  addWallFace(outer, true)

  if (coveRadius > GEOMETRY_EPSILON) {
    const inset = coveInner
    const radialSegments = 8
    const covePoint = (index: number, angle: number): ProfiledPoint => {
      const boundary = inner[index]!
      const floorEdge = inset[index]!
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
      for (let segment = 0; segment < radialSegments; segment += 1) {
        const startAngle = segment / radialSegments * Math.PI / 2
        const endAngle = (segment + 1) / radialSegments * Math.PI / 2
        const first = covePoint(index, startAngle)
        const second = covePoint(nextIndex, startAngle)
        const third = covePoint(nextIndex, endAngle)
        const fourth = covePoint(index, endAngle)
        addCoveTriangle(first, second, third)
        addCoveTriangle(first, third, fourth)
      }
    }
  }

  for (let index = 0; index < inner.length; index += 1) {
    const nextIndex = (index + 1) % inner.length
    const innerCurrent: Point3 = [inner[index]![0], 0, inner[index]![1]]
    const innerNext: Point3 = [inner[nextIndex]![0], 0, inner[nextIndex]![1]]
    const outerCurrent: Point3 = [outer[index]![0], 0, outer[index]![1]]
    const outerNext: Point3 = [outer[nextIndex]![0], 0, outer[nextIndex]![1]]
    pushQuad(positions, innerCurrent, outerCurrent, outerNext, innerNext)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
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

function createWaterGeometry(points: PoolPoint[]) {
  const xs = points.map(([x]) => x)
  const zs = points.map(([, z]) => z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const span = Math.max(maxX - minX, maxZ - minZ)
  const maxEdge = Math.max(0.06, span / 96)
  const geometry = new TessellateModifier(maxEdge, 8).modify(
    new ShapeGeometry(traceShape(points)),
  )
  geometry.rotateX(-Math.PI / 2)
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
  const material = new MeshBasicNodeMaterial({ color: node.shellColor, side: DoubleSide })
  const normal = normalLocal.abs()
  const isFloor = normal.y.greaterThan(0.65)
  const wallU = normal.x.greaterThan(normal.z).select(positionLocal.z, positionLocal.x)
  const sourceU = isFloor.select(positionLocal.x, wallU)
  const sourceV = isFloor.select(positionLocal.z, positionLocal.y)

  // 25 cm square ceramic tiles. The small fixed warp keeps the grid from
  // reading like graph paper while preserving clean grout through corners.
  const tileScale = 4
  const tileU = sourceU.mul(tileScale).add(sin(sourceV.mul(2.8)).mul(0.035))
  const tileV = sourceV.mul(tileScale).add(sin(sourceU.mul(2.4)).mul(0.035))
  const cellU = tileU.floor()
  const cellV = tileV.floor()
  const withinU = tileU.fract()
  const withinV = tileV.fract()
  const edgeU = withinU.min(float(1).sub(withinU))
  const edgeV = withinV.min(float(1).sub(withinV))
  const tileMask = smoothstep(0.035, 0.07, edgeU.min(edgeV))
  const variation = sin(cellU.mul(12.9898).add(cellV.mul(78.233))).mul(43758.5453).fract()
  const ceramic = mix(color('#1496b5'), color('#5dd4d8'), variation)
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
  const tiledShell = mix(color('#c5d3d1'), ceramic, tileMask).add(caustic)
  material.colorNode = tiledShell
  return material
}

export function buildPoolGeometry(nodeInput: PoolNode): Group {
  // Plugin renderers can receive stored scene data before the registry has
  // materialized defaults added by a newer schema version. Normalize once at
  // this boundary so every downstream dimension is finite.
  const node = PoolNode.parse(nodeInput)
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
  const copingMaterial = new MeshBasicNodeMaterial({ color: node.copingColor, side: DoubleSide })
  const depth = getPoolDepthResolver(node, inner)
  const cuts = depth.profile.kind === 'shallow-to-deep'
    ? [
        depth.minimumX + (depth.maximumX - depth.minimumX) * depth.profile.slopeStart / 100,
        depth.minimumX + (depth.maximumX - depth.minimumX) * depth.profile.slopeEnd / 100,
      ]
    : []

  const floor = new Mesh(
    createPoolFloorGeometry(inner, depth.depthAtX, node.floorThickness, cuts),
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
    ),
    shellMaterial,
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
    const width = Math.min(node.benchWidth, (depth.maximumX - depth.minimumX) * 0.3)
    const startX = depth.maximumX - width
    const bench = new Mesh(
      createEndPlatformGeometry(
        inner,
        depth.depthAtX,
        startX,
        depth.maximumX,
        node.benchWaterDepth,
        startX,
      ),
      shellMaterial,
    )
    bench.name = 'pool-bench'
    group.add(bench)
  }

  const water = new Mesh(createWaterGeometry(inner), waterEffect.material)
  water.name = 'pool-water'
  water.position.y = waterElevation - node.finishedDeckElevation
  water.renderOrder = 1
  // Water is purely visual and must never block picking or placement rays.
  // Leave the animated surface rendered while allowing tools to hit the
  // actual pool shell/floor beneath it.
  water.raycast = () => undefined
  group.add(water)

  if (node.copingStyle === 'natural-stone') {
    group.add(buildNaturalCopingGeometry(inner, {
      width: Math.max(node.copingWidth, node.shellThickness + 0.03),
      thickness: node.copingThickness,
      stoneLength: node.copingStoneLength,
      jointWidth: node.copingJointWidth,
      irregularity: node.copingIrregularity,
      seed: node.copingSeed,
      color: node.copingColor,
    }))
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

  group.userData.waterEffect = waterEffect
  group.userData.outlineWarnings = outlines.warnings

  return group
}
