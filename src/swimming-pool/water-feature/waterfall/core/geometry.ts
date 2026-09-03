import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import {
  WaterfallMistEffect,
  WaterfallPoolEffect,
  WaterfallWaterEffect,
} from '../../../shader/waterfall-effect'
import {
  createLowPolyRockMesh,
  type LowPolyRockProfile,
} from '../../../design/low-poly-rock'
import { getPoolRockColor } from '../../../design/rock-colors'
import { DEFAULT_POOL_WATERFALL } from './definition'
import type { PoolWaterfallNode } from './schema'

type RockPlacement = {
  x: number
  y: number
  z: number
  width: number
  height: number
  depth: number
  profile: LowPolyRockProfile
  yaw?: number
  roll?: number
}

const MOUND_ROCKS: readonly RockPlacement[] = [
  { x: -0.47, y: 0, z: -0.04, width: 0.27, height: 0.27, depth: 0.58, profile: 'ledge', yaw: 0.12, roll: -0.03 },
  { x: -0.28, y: 0.01, z: -0.13, width: 0.27, height: 0.34, depth: 0.56, profile: 'boulder', yaw: -0.18, roll: 0.04 },
  { x: -0.08, y: 0, z: -0.2, width: 0.24, height: 0.3, depth: 0.62, profile: 'wedge', yaw: 0.2 },
  { x: 0.12, y: -0.01, z: -0.2, width: 0.27, height: 0.34, depth: 0.6, profile: 'boulder', yaw: -0.12 },
  { x: 0.33, y: 0.01, z: -0.13, width: 0.26, height: 0.3, depth: 0.55, profile: 'ledge', yaw: 0.24, roll: -0.04 },
  { x: 0.5, y: 0, z: -0.02, width: 0.25, height: 0.27, depth: 0.56, profile: 'shard', yaw: -0.1, roll: 0.05 },
  { x: 0, y: 0.07, z: -0.39, width: 0.31, height: 0.48, depth: 0.4, profile: 'boulder', yaw: 0.08 },
  { x: -0.13, y: 0.37, z: -0.43, width: 0.25, height: 0.4, depth: 0.36, profile: 'pillar', yaw: -0.14, roll: 0.04 },
  { x: 0.14, y: 0.36, z: -0.43, width: 0.25, height: 0.41, depth: 0.37, profile: 'wedge', yaw: 0.15, roll: -0.04 },
  { x: -0.52, y: 0.17, z: -0.2, width: 0.25, height: 0.31, depth: 0.5, profile: 'wedge', yaw: -0.22, roll: 0.05 },
  { x: -0.33, y: 0.21, z: -0.26, width: 0.25, height: 0.35, depth: 0.52, profile: 'pillar', yaw: 0.16, roll: -0.04 },
  { x: -0.12, y: 0.24, z: -0.31, width: 0.21, height: 0.35, depth: 0.46, profile: 'peak', yaw: -0.14, roll: 0.06 },
  { x: 0.13, y: 0.23, z: -0.31, width: 0.22, height: 0.36, depth: 0.48, profile: 'pillar', yaw: 0.14, roll: -0.05 },
  { x: 0.34, y: 0.2, z: -0.26, width: 0.25, height: 0.34, depth: 0.5, profile: 'wedge', yaw: -0.18 },
  { x: 0.53, y: 0.17, z: -0.18, width: 0.24, height: 0.3, depth: 0.48, profile: 'boulder', yaw: 0.22, roll: -0.04 },
  { x: -0.43, y: 0.42, z: -0.31, width: 0.25, height: 0.32, depth: 0.43, profile: 'boulder', yaw: 0.2, roll: -0.04 },
  { x: -0.23, y: 0.47, z: -0.35, width: 0.22, height: 0.34, depth: 0.42, profile: 'shard', yaw: -0.2, roll: 0.06 },
  { x: 0.23, y: 0.46, z: -0.35, width: 0.23, height: 0.36, depth: 0.43, profile: 'peak', yaw: 0.13, roll: -0.05 },
  { x: 0.44, y: 0.41, z: -0.3, width: 0.25, height: 0.32, depth: 0.44, profile: 'boulder', yaw: -0.23, roll: 0.04 },
  { x: -0.34, y: 0.66, z: -0.34, width: 0.27, height: 0.31, depth: 0.4, profile: 'pillar', yaw: -0.12, roll: 0.04 },
  { x: -0.1, y: 0.7, z: -0.4, width: 0.22, height: 0.31, depth: 0.4, profile: 'wedge', yaw: 0.15, roll: -0.03 },
  { x: 0.16, y: 0.69, z: -0.39, width: 0.23, height: 0.33, depth: 0.39, profile: 'pillar', yaw: -0.14, roll: 0.05 },
  { x: 0.38, y: 0.65, z: -0.33, width: 0.26, height: 0.3, depth: 0.4, profile: 'shard', yaw: 0.18, roll: -0.04 },
  { x: -0.18, y: 0.82, z: -0.34, width: 0.24, height: 0.19, depth: 0.43, profile: 'ledge', yaw: 0.08, roll: -0.03 },
  { x: 0.17, y: 0.81, z: -0.34, width: 0.25, height: 0.2, depth: 0.43, profile: 'ledge', yaw: -0.1, roll: 0.03 },
]

const POND_EDGE_ROCKS = [
  [-0.53, 0.02, 0.03, 0.22, 0.23, 0.32, 'boulder', 0.15],
  [0.53, 0.02, 0.04, 0.23, 0.24, 0.33, 'wedge', -0.18],
  [-0.56, 0.01, 0.25, 0.2, 0.2, 0.3, 'ledge', -0.1],
  [0.56, 0.01, 0.26, 0.21, 0.22, 0.31, 'boulder', 0.2],
  [-0.58, 0, 0.48, 0.18, 0.18, 0.28, 'shard', 0.24],
  [0.58, 0, 0.49, 0.19, 0.2, 0.29, 'ledge', -0.2],
  [-0.55, -0.01, 0.7, 0.18, 0.17, 0.25, 'wedge', -0.16],
  [0.55, -0.01, 0.71, 0.18, 0.18, 0.26, 'peak', 0.18],
] as const satisfies ReadonlyArray<readonly [number, number, number, number, number, number, LowPolyRockProfile, number]>

const FLAT_EDGE_CURVE: Array<[number, number]> = [[-1, 0], [0, 0], [1, 0]]
// The authored centers intentionally overlap. This extra packing keeps the
// tapered low-poly silhouettes touching instead of exposing daylight seams.
const ROCK_PACKING_WIDTH = 1.2
const ROCK_PACKING_DEPTH = 1.12

export function buildWaterfallGeometry(node: PoolWaterfallNode) {
  // Scene hydration can hand renderers nodes saved under an older schema version
  // without reapplying Zod defaults. Normalize newly-added placement fields here
  // so legacy waterfalls remain renderable.
  // Strip undefined values first: spreading a hydrated-but-partial node over
  // the defaults would otherwise reintroduce undefined dimensions and produce
  // NaN buffer bounds for the receiving-pool rocks.
  const definedNode = Object.fromEntries(
    Object.entries(node).filter(([, value]) => value !== undefined),
  )
  const normalized: PoolWaterfallNode = {
    ...DEFAULT_POOL_WATERFALL,
    ...definedNode,
    edgeCurve: Array.isArray(definedNode.edgeCurve) && definedNode.edgeCurve.length >= 2
      ? definedNode.edgeCurve as Array<[number, number]>
      : FLAT_EDGE_CURVE,
    targetWaterOffset: Number.isFinite(definedNode.targetWaterOffset)
      ? definedNode.targetWaterOffset as number
      : 0,
  } as PoolWaterfallNode
  return normalized.waterfallType === 'modern'
    ? buildModernWaterfallGeometry(normalized)
    : buildRockWaterfallGeometry(normalized)
}

function buildModernWaterfallGeometry(node: PoolWaterfallNode) {
  const group = new Group()
  group.name = 'pool-waterfall-modern'
  addReceivingPool(group, node)
  const structure = new MeshStandardMaterial({ color: node.structureColor, roughness: 0.82 })
  const wall = new Mesh(new BoxGeometry(node.width, node.height, node.depth), structure)
  wall.position.y = node.height / 2
  wall.name = 'waterfall-modern-wall'
  wall.castShadow = true
  wall.receiveShadow = true
  group.add(wall)
  const lip = new Mesh(new BoxGeometry(node.width, node.lipThickness, node.depth + 0.16), structure)
  lip.position.set(0, node.height - node.lipThickness / 2, node.depth / 2 + 0.08)
  lip.name = 'waterfall-modern-lip'
  group.add(lip)
  const fallZ = node.depth / 2 + node.sheetDepth
  // The open spillway sits just above the solid modern headwall so the
  // horizontal water run remains visible before it rolls over the edge.
  const topY = node.height + node.lipThickness * 0.15
  const flowWidth = node.width - 0.08
  addSpillwayBox(group, node, flowWidth, topY, fallZ)
  if (node.showFlow) {
    addWaterSheet(group, flowWidth, topY - node.targetWaterOffset, topY, fallZ, node)
    const landingZ = getSpillwayLandingZ(fallZ, node.sheetDepth)
    addMist(group, node.width * 0.55, node.targetWaterOffset, landingZ + 0.04, node.shallowWaterColor)
  }
  return group
}

function buildRockWaterfallGeometry(node: PoolWaterfallNode) {
  const group = new Group()
  group.name = `pool-waterfall-${node.waterfallType}`
  addReceivingPool(group, node)

  const heightScale = node.waterfallType === 'spillover' ? 0.72 : 1
  for (const [index, rock] of MOUND_ROCKS.entries()) {
    addRock(group, node, {
      ...rock,
      y: rock.y * heightScale,
      height: rock.height * heightScale,
    }, index)
  }
  if (!node.poolId) addPondEdgeRocks(group, node, MOUND_ROCKS.length)

  const topY = node.height * (node.waterfallType === 'spillover' ? 0.66 : 0.82)
  const fallZ = node.depth * 0.24
  const fallWidth = node.width * 0.3
  addSpillwayBox(group, node, fallWidth, topY, fallZ)
  if (node.showFlow) {
    addWaterSheet(group, fallWidth, topY - node.targetWaterOffset, topY, fallZ, node)
    const impactZ = getSpillwayLandingZ(fallZ, node.sheetDepth)
    addMist(group, fallWidth, node.targetWaterOffset, impactZ + 0.04, node.shallowWaterColor)
  }
  return group
}

function addRock(group: Group, node: PoolWaterfallNode, rock: RockPlacement, index: number) {
  const seed = node.rockSeed + index * 7919
  const wetness = Math.max(0, 1 - rock.y / 0.25) * 0.7
  const color = waterfallRockColor(node.rockSeed, index, wetness)
  const mesh = createLowPolyRockMesh(
    rock.width * node.width * ROCK_PACKING_WIDTH,
    rock.height * node.height,
    rock.depth * node.depth * ROCK_PACKING_DEPTH,
    seed,
    color,
    rock.profile,
    0.96 - wetness * 0.2,
  )
  mesh.name = `waterfall-rock-${index}-${rock.profile}`
  const x = rock.x * node.width
  const edge = sampleEdgeCurve(node.edgeCurve, x)
  mesh.position.set(x, rock.y * node.height, rock.z * node.depth + edge.z)
  mesh.rotation.set(
    Math.sin(seed * 0.0017) * 0.035,
    (rock.yaw ?? Math.sin(seed * 0.0023) * 0.18) - Math.atan(edge.slope),
    rock.roll ?? Math.cos(seed * 0.0019) * 0.045,
  )
  group.add(mesh)
}

function addPondEdgeRocks(group: Group, node: PoolWaterfallNode, startIndex: number) {
  for (const [offset, rock] of POND_EDGE_ROCKS.entries()) {
    const [x, y, z, width, height, depth, profile, yaw] = rock
    const index = startIndex + offset
    const seed = node.rockSeed + index * 7919
    const mesh = createLowPolyRockMesh(
      width * node.receivingPoolWidth,
      height * node.height,
      depth * node.receivingPoolDepth,
      seed,
      waterfallRockColor(node.rockSeed, index, 0.7),
      profile,
      0.82,
    )
    mesh.name = `waterfall-rock-${index}-${profile}`
    mesh.position.set(x * node.receivingPoolWidth, y * node.height, z * node.receivingPoolDepth)
    mesh.rotation.set(0, yaw, Math.sin(seed * 0.0013) * 0.04)
    group.add(mesh)
  }
}

function waterfallRockColor(seed: number, index: number, wetness: number) {
  const color = getPoolRockColor(seed, index)
  return `#${color.offsetHSL(0, -wetness * 0.025, -wetness * 0.08).getHexString()}`
}

function addReceivingPool(group: Group, node: PoolWaterfallNode) {
  if (!node.receivingPoolEnabled) return
  const centerZ = node.receivingPoolDepth * 0.36
  const bed = new Mesh(
    new CircleGeometry(1, 72),
    new MeshStandardMaterial({ color: node.poolBedColor, roughness: 0.94 }),
  )
  bed.name = 'waterfall-receiving-bed'
  bed.rotation.x = -Math.PI / 2
  bed.scale.set(node.receivingPoolWidth * 0.53, node.receivingPoolDepth * 0.53, 1)
  bed.position.set(0, -0.035, centerZ)
  bed.receiveShadow = true
  group.add(bed)

  const effect = new WaterfallPoolEffect(node)
  const water = new Mesh(new CircleGeometry(1, 96), effect.material)
  water.name = 'waterfall-receiving-water'
  water.rotation.x = -Math.PI / 2
  water.scale.set(node.receivingPoolWidth * 0.5, node.receivingPoolDepth * 0.5, 1)
  water.position.set(0, 0.012, centerZ)
  water.renderOrder = 1
  water.userData.waterfallEffect = effect
  water.userData.waterPreset = node.waterPreset
  water.userData.shallowWaterColor = node.shallowWaterColor
  water.userData.deepWaterColor = node.deepWaterColor
  group.add(water)
}

function addWaterSheet(group: Group, width: number, height: number, topY: number, z: number, node: PoolWaterfallNode) {
  const effect = new WaterfallWaterEffect(node, node.flowStrength)
  const geometry = createSpillwayGeometry(
    width,
    height,
    getSpillwayApproach(node.depth),
    getSpillwayCurveRadius(node.sheetDepth),
    node.sheetDepth,
  )
  const water = new Mesh(geometry, effect.material)
  water.position.set(0, topY + 0.012, z)
  water.name = 'waterfall-water-sheet'
  water.renderOrder = 3
  water.userData.waterfallEffect = effect
  water.userData.waterPreset = node.waterPreset
  water.userData.shallowWaterColor = node.shallowWaterColor
  water.userData.deepWaterColor = node.deepWaterColor
  group.add(water)
}

function addSpillwayBox(
  group: Group,
  node: PoolWaterfallNode,
  waterWidth: number,
  waterY: number,
  lipZ: number,
) {
  const box = new Group()
  box.name = 'waterfall-spillway-box'
  const approach = getSpillwayApproach(node.depth)
  const wallThickness = Math.max(0.065, node.lipThickness * 0.9)
  const boxWidth = waterWidth + wallThickness * 3.4
  const boxHeight = Math.max(0.3, node.lipThickness * 4)
  const sourceZ = lipZ - approach
  const hoodDepth = Math.min(approach * 0.48, Math.max(0.2, wallThickness * 2.8))
  const cornerRadius = Math.min(wallThickness * 0.36, 0.035)
  const structure = new MeshStandardMaterial({
    color: node.structureColor,
    roughness: 0.78,
    metalness: 0.02,
  })
  const linerColor = new Color(node.structureColor).multiplyScalar(0.48)
  const liner = new MeshStandardMaterial({ color: linerColor, roughness: 0.58, metalness: 0.08 })
  const cavity = new MeshStandardMaterial({ color: '#050c10', roughness: 0.96, metalness: 0 })

  const floorDepth = approach + wallThickness * 0.95
  const floorDrop = wallThickness * 0.38
  const floorAngle = Math.atan2(floorDrop, floorDepth)
  const floor = createRoundedSpillwayPart(
    'waterfall-spillway-base',
    boxWidth,
    wallThickness,
    floorDepth,
    cornerRadius,
    structure,
  )
  floor.position.set(0, waterY - wallThickness * 0.82, lipZ - approach / 2)
  floor.rotation.x = floorAngle
  box.add(floor)

  for (const side of [-1, 1] as const) {
    const wall = createRoundedSpillwayPart(
      side < 0 ? 'waterfall-spillway-left' : 'waterfall-spillway-right',
      wallThickness,
      boxHeight,
      floorDepth,
      cornerRadius,
      structure,
    )
    wall.position.set(
      side * (boxWidth - wallThickness) / 2,
      waterY + boxHeight * 0.18,
      lipZ - approach / 2,
    )
    box.add(wall)
  }

  const back = createRoundedSpillwayPart(
    'waterfall-spillway-back',
    boxWidth,
    boxHeight,
    wallThickness,
    cornerRadius,
    structure,
  )
  back.position.set(0, waterY + boxHeight * 0.18, sourceZ - wallThickness * 0.38)
  box.add(back)

  const canopy = createRoundedSpillwayPart(
    'waterfall-spillway-canopy',
    boxWidth,
    wallThickness * 1.15,
    hoodDepth,
    cornerRadius,
    structure,
  )
  canopy.position.set(
    0,
    waterY + boxHeight * 0.68,
    sourceZ + hoodDepth * 0.5 - wallThickness * 0.38,
  )
  box.add(canopy)

  const openingHeight = boxHeight * 0.48
  const opening = new Mesh(
    new RoundedBoxGeometry(waterWidth + wallThickness * 0.28, openingHeight, wallThickness * 0.32, 2, cornerRadius * 0.45),
    cavity,
  )
  opening.name = 'waterfall-spillway-opening'
  opening.position.set(0, waterY + openingHeight * 0.08, sourceZ + wallThickness * 0.12)
  opening.receiveShadow = true
  box.add(opening)

  const channel = createRoundedSpillwayPart(
    'waterfall-spillway-channel',
    waterWidth + wallThickness * 0.24,
    wallThickness * 0.22,
    approach - hoodDepth * 0.32,
    cornerRadius * 0.45,
    liner,
  )
  channel.position.set(
    0,
    waterY - wallThickness * 0.2,
    lipZ - (approach - hoodDepth * 0.32) / 2,
  )
  channel.rotation.x = floorAngle * 0.55
  channel.receiveShadow = true
  box.add(channel)

  const sill = createRoundedSpillwayPart(
    'waterfall-spillway-sill',
    boxWidth + wallThickness * 0.35,
    wallThickness * 0.72,
    wallThickness * 1.5,
    cornerRadius,
    structure,
  )
  sill.position.set(0, waterY - wallThickness * 0.56, lipZ + wallThickness * 0.3)
  sill.receiveShadow = true
  box.add(sill)

  group.add(box)
}

function createRoundedSpillwayPart(
  name: string,
  width: number,
  height: number,
  depth: number,
  radius: number,
  material: MeshStandardMaterial,
) {
  const geometry = new RoundedBoxGeometry(width, height, depth, 2, Math.min(radius, width * 0.2, height * 0.2, depth * 0.2))
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function createSpillwayGeometry(
  width: number,
  height: number,
  approach: number,
  curveRadius: number,
  sheetDepth: number,
) {
  const xSegments = 40
  const pathSegments = 96
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const curveLength = Math.PI * curveRadius / 2
  const verticalLength = Math.max(0.08, height - curveRadius)
  const pathLength = approach + curveLength + verticalLength

  for (let pathIndex = 0; pathIndex <= pathSegments; pathIndex += 1) {
    const progress = pathIndex / pathSegments
    const distance = progress * pathLength
    let pathY = 0
    let pathZ = -approach
    let normalY = 1
    let normalZ = 0

    if (distance <= approach) {
      pathZ += distance
    } else if (distance <= approach + curveLength) {
      const angle = (distance - approach) / curveLength * Math.PI / 2
      pathY = -curveRadius * (1 - Math.cos(angle))
      pathZ = curveRadius * Math.sin(angle)
      normalY = Math.cos(angle)
      normalZ = Math.sin(angle)
    } else {
      const fallDistance = distance - approach - curveLength
      const fallProgress = fallDistance / verticalLength
      pathY = -curveRadius - fallDistance
      pathZ = curveRadius + fallProgress * fallProgress * sheetDepth * 1.6
      normalY = 0
      normalZ = 1
    }

    for (let xIndex = 0; xIndex <= xSegments; xIndex += 1) {
      const u = xIndex / xSegments
      const x = (u - 0.5) * Math.max(0.08, width)
      const across = u - 0.5
      const corrugation = (
        Math.sin(across * Math.PI * 10)
        + Math.sin(across * Math.PI * 23 + 0.4) * 0.34
      ) * sheetDepth * 0.1
      const bottomInfluence = Math.max(0, Math.min(1, (progress - 0.82) / 0.18))
      const raggedBottom = Math.abs(
        Math.sin(across * Math.PI * 13 + 0.7)
        + Math.sin(across * Math.PI * 29) * 0.45,
      ) * height * 0.022 * bottomInfluence
      positions.push(
        x,
        pathY + normalY * corrugation + raggedBottom,
        pathZ + normalZ * corrugation,
      )
      uvs.push(u, progress)
    }
  }

  const rowSize = xSegments + 1
  for (let pathIndex = 0; pathIndex < pathSegments; pathIndex += 1) {
    for (let xIndex = 0; xIndex < xSegments; xIndex += 1) {
      const a = pathIndex * rowSize + xIndex
      const b = a + 1
      const d = a + rowSize
      const c = d + 1
      indices.push(a, d, b, b, d, c)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function getSpillwayApproach(depth: number) {
  return Math.max(0.22, Math.min(0.55, depth * 0.34))
}

function getSpillwayCurveRadius(sheetDepth: number) {
  return Math.max(0.08, sheetDepth * 2.4)
}

function getSpillwayLandingZ(lipZ: number, sheetDepth: number) {
  return lipZ + getSpillwayCurveRadius(sheetDepth) + sheetDepth * 1.6
}

function addMist(group: Group, width: number, y: number, z: number, waterColor: string) {
  const effect = new WaterfallMistEffect(width, z, waterColor)
  effect.points.position.y = y
  effect.points.userData.waterfallEffect = effect
  group.add(effect.points)
}

function sampleEdgeCurve(curve: readonly (readonly [number, number])[] | null | undefined, x: number) {
  if (!curve || curve.length < 2) return { z: 0, slope: 0 }
  const first = curve[0]!
  const last = curve[curve.length - 1]!
  if (x <= first[0]) return segmentValue(first, curve[1]!, x)
  if (x >= last[0]) return segmentValue(curve[curve.length - 2]!, last, x)
  for (let index = 0; index < curve.length - 1; index += 1) {
    const a = curve[index]!
    const b = curve[index + 1]!
    if (x >= a[0] && x <= b[0]) return segmentValue(a, b, x)
  }
  return { z: 0, slope: 0 }
}

function segmentValue(a: readonly [number, number], b: readonly [number, number], x: number) {
  const dx = b[0] - a[0]
  const slope = Math.abs(dx) > 1e-6 ? (b[1] - a[1]) / dx : 0
  return { z: a[1] + (x - a[0]) * slope, slope }
}
