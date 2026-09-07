import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  WaterfallBubbleCloudEffect,
  WaterfallLineEffect,
  WaterfallPoolEffect,
  WaterfallWaterEffect,
} from '../../../shader/waterfall-effect'
import type { WaterfallBubbleFamily } from '../../../shader/waterfall-effect'
import {
  createLowPolyRockGeometry,
  type LowPolyRockProfile,
} from '../../../design/low-poly-rock'
import { PoolWaterfallNode } from './schema'

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

const MOUND_ROCK_ROWS: readonly (readonly RockPlacement[])[] = [
  MOUND_ROCKS.filter((rock) => rock.y < 0.15),
  MOUND_ROCKS.filter((rock) => rock.y >= 0.15 && rock.y < 0.35),
  MOUND_ROCKS.filter((rock) => rock.y >= 0.35 && rock.y < 0.58),
  MOUND_ROCKS.filter((rock) => rock.y >= 0.58 && rock.y < 0.78),
  MOUND_ROCKS.filter((rock) => rock.y >= 0.78),
]

function adaptiveMoundRocks(node: PoolWaterfallNode) {
  const widthScale = Math.max(0.65, Math.min(1.7, node.width / 3.6))
  const density = Math.pow(widthScale, 0.58)
  const rocks: RockPlacement[] = []
  for (const [rowIndex, row] of MOUND_ROCK_ROWS.entries()) {
    const targetCount = Math.max(1, Math.round(row.length * density))
    for (let index = 0; index < targetCount; index += 1) {
      // At the default width retain the authored formation exactly. Other
      // widths interpolate across each layer so every size still has a real
      // foundation, middle mass, side fill, and cap rather than a stretched
      // duplicate of the same asset.
      if (targetCount === row.length) {
        rocks.push(row[index]!)
        continue
      }
      const sourceT = targetCount === 1 ? 0.5 : index / (targetCount - 1)
      const sourceIndex = Math.min(row.length - 1, Math.round(sourceT * (row.length - 1)))
      const source = row[sourceIndex]!
      const first = row[0]!
      const last = row[row.length - 1]!
      const x = first.x + (last.x - first.x) * sourceT
      const jitter = Math.sin((node.rockSeed + rowIndex * 101 + index * 7919) * 0.017) * 0.025
      const sizeScale = Math.max(0.72, Math.min(1.28, row.length / targetCount * 1.04))
      rocks.push({
        ...source,
        x: x + jitter,
        z: source.z + Math.cos((node.rockSeed + index * 43) * 0.013) * 0.018,
        width: source.width * sizeScale,
        depth: source.depth * sizeScale,
      })
    }
  }
  return rocks
}

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
  const normalized = PoolWaterfallNode.parse(definedNode)
  if (normalized.waterfallType === 'modern') return buildModernWaterfallGeometry(normalized)
  if (normalized.waterfallType === 'spillover') return buildSpilloverWaterfallGeometry(normalized)
  return buildRockWaterfallGeometry(normalized)
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
  const extension = Math.max(0, getWaterfallLipZ(node) - (node.depth / 2 + node.sheetDepth))
  const lip = new Mesh(new BoxGeometry(node.width, node.lipThickness, node.depth + 0.16 + extension), structure)
  lip.position.set(0, node.height - node.lipThickness / 2, node.depth / 2 + 0.08 + extension / 2)
  lip.name = 'waterfall-modern-lip'
  group.add(lip)
  const fallZ = getWaterfallLipZ(node)
  // The open spillway sits just above the solid modern headwall so the
  // horizontal water run remains visible before it rolls over the edge.
  const topY = node.height + node.lipThickness * 0.15
  const flowWidth = Math.max(0.24, node.width - 0.08)
  addSpillwayBox(group, node, flowWidth, topY, fallZ)
  if (node.showFlow) {
    addWaterSheet(group, flowWidth, topY - node.targetWaterOffset, topY, fallZ, node)
  }
  return group
}

function buildRockWaterfallGeometry(node: PoolWaterfallNode) {
  const group = new Group()
  group.name = `pool-waterfall-${node.waterfallType}`
  addReceivingPool(group, node)

  const moundRocks = adaptiveMoundRocks(node)
  const moundMaterial = createRockMaterial(0.96)
  group.add(mergeRockMeshes(
    moundRocks.map((rock, index) => createRock(node, rock, index, moundMaterial)),
    'waterfall-rock-mound',
    moundMaterial,
  ))
  if (!node.poolId) group.add(createPondEdgeRocks(node, moundRocks.length, createRockMaterial(0.82)))

  const topY = node.height * 0.82
  const fallZ = getWaterfallLipZ(node)
  const fallWidth = node.width * 0.3
  // Natural cascades use a recessed void framed by the rocks. The engineered
  // rounded spillway belongs only to the modern variant; showing it here made
  // the rock formation read as a box with stones attached to it.
  addNaturalCavity(group, node, fallWidth, topY, fallZ)
  addNaturalChannel(group, node, fallWidth, topY, fallZ)
  if (node.showFlow) {
    addWaterSheet(group, fallWidth, topY - node.targetWaterOffset, topY, fallZ, node)
  }
  return group
}

function buildSpilloverWaterfallGeometry(node: PoolWaterfallNode) {
  const group = new Group()
  group.name = 'pool-waterfall-spillover'
  addReceivingPool(group, node)

  const rocks = adaptiveMoundRocks(node).filter((rock) => rock.y < 0.35)
  const rockMaterial = createRockMaterial(0.96)
  group.add(mergeRockMeshes(rocks.map((rock, index) => createRock(node, {
      ...rock,
      y: rock.y * 0.62,
      height: rock.height * 0.58,
      depth: rock.depth * 0.82,
    }, index, rockMaterial)), 'waterfall-rock-spillover', rockMaterial))
  if (!node.poolId) group.add(createPondEdgeRocks(node, rocks.length, createRockMaterial(0.82)))

  const topY = node.height * 0.38
  const fallZ = getWaterfallLipZ(node)
  const fallWidth = node.width * 0.72
  addSpilloverWeir(group, node, fallWidth, topY, fallZ)
  addNaturalChannel(group, node, fallWidth, topY, fallZ)
  if (node.showFlow) addWaterSheet(group, fallWidth, topY - node.targetWaterOffset, topY, fallZ, node)
  return group
}

function createRockMaterial(roughness: number) {
  return new MeshStandardMaterial({
    color: '#ffffff',
    roughness,
    metalness: 0,
    flatShading: true,
    vertexColors: true,
  })
}

function createRock(
  node: PoolWaterfallNode,
  rock: RockPlacement,
  index: number,
  material: MeshStandardMaterial,
) {
  const seed = node.rockSeed + index * 7919
  const color = waterfallRockColor(node.rockColor, node.poolRockSeed, node.rockSeed, index)
  const mesh = new Mesh(createLowPolyRockGeometry(
    rock.width * node.width * ROCK_PACKING_WIDTH,
    rock.height * node.height,
    rock.depth * node.depth * ROCK_PACKING_DEPTH,
    seed,
    rock.profile,
    color,
  ), material)
  mesh.name = `waterfall-rock-${index}-${rock.profile}`
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.rockProfile = rock.profile
  mesh.userData.seed = seed
  const x = rock.x * node.width
  const edge = sampleEdgeCurve(node.edgeCurve, x)
  mesh.position.set(x, rock.y * node.height, rock.z * node.depth + edge.z)
  mesh.rotation.set(
    Math.sin(seed * 0.0017) * 0.035,
    (rock.yaw ?? Math.sin(seed * 0.0023) * 0.18) - Math.atan(edge.slope),
    rock.roll ?? Math.cos(seed * 0.0019) * 0.045,
  )
  return mesh
}

function createPondEdgeRocks(
  node: PoolWaterfallNode,
  startIndex: number,
  material: MeshStandardMaterial,
) {
  const rocks: Mesh[] = []
  for (const [offset, rock] of POND_EDGE_ROCKS.entries()) {
    const [x, y, z, width, height, depth, profile, yaw] = rock
    const index = startIndex + offset
    const seed = node.rockSeed + index * 7919
    const mesh = new Mesh(createLowPolyRockGeometry(
      width * node.receivingPoolWidth,
      height * node.height,
      depth * node.receivingPoolDepth,
      seed,
      profile,
      waterfallRockColor(node.rockColor, node.poolRockSeed, node.rockSeed, index),
    ), material)
    mesh.name = `waterfall-rock-${index}-${profile}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.rockProfile = profile
    mesh.userData.seed = seed
    mesh.position.set(x * node.receivingPoolWidth, y * node.height, z * node.receivingPoolDepth)
    mesh.rotation.set(0, yaw, Math.sin(seed * 0.0013) * 0.04)
    rocks.push(mesh)
  }
  return mergeRockMeshes(rocks, 'waterfall-rock-pond-edge', material)
}

function mergeRockMeshes(rocks: readonly Mesh[], name: string, material: MeshStandardMaterial) {
  const geometries = rocks.map((rock) => {
    rock.updateMatrix()
    return rock.geometry.clone().applyMatrix4(rock.matrix)
  })
  const geometry = mergeGeometries(geometries, false)
  for (const source of geometries) source.dispose()
  if (!geometry) throw new Error(`Unable to merge ${name} geometry`)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const mesh = new Mesh(geometry, material)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.rockCount = rocks.length
  mesh.userData.rockProfiles = [...new Set(rocks.map((rock) => rock.userData.rockProfile as LowPolyRockProfile))]
  return mesh
}

function waterfallRockColor(baseColor: string, poolRockSeed: number | null, seed: number, index: number) {
  // Keep the user-selected rock color authoritative while retaining subtle,
  // deterministic facet-to-facet variation from the seed.
  const color = new Color(baseColor)
  const colorSeed = poolRockSeed ?? seed
  const variation = Math.sin((colorSeed + index * 7919) * 0.017) * 0.018
  color.offsetHSL(variation, 0, variation)
  return `#${color.getHexString()}`
}

function addSpilloverWeir(
  group: Group,
  node: PoolWaterfallNode,
  waterWidth: number,
  waterY: number,
  lipZ: number,
) {
  const thickness = Math.max(0.07, node.lipThickness)
  const weir = new Mesh(
    new RoundedBoxGeometry(waterWidth + thickness * 2.4, thickness * 1.4, thickness * 2.2, 2, thickness * 0.25),
    new MeshStandardMaterial({ color: node.rockColor, roughness: 0.92, metalness: 0 }),
  )
  weir.name = 'waterfall-spillover-weir'
  weir.position.set(0, waterY - thickness * 0.85, lipZ + thickness * 0.15)
  weir.castShadow = true
  weir.receiveShadow = true
  group.add(weir)
}

function addNaturalCavity(
  group: Group,
  node: PoolWaterfallNode,
  waterWidth: number,
  waterY: number,
  lipZ: number,
) {
  const approach = getSpillwayApproach(node.depth)
  const openingWidth = Math.max(0.18, waterWidth * 0.92)
  const openingHeight = Math.max(0.22, node.height * 0.22)
  const frame = Math.max(0.07, node.lipThickness * 1.35)
  const boxWidth = openingWidth + frame * 2
  const boxHeight = openingHeight + frame * 2
  const depth = Math.max(0.16, node.lipThickness * 2.8)
  const centerY = waterY - node.height * 0.14
  const sourceZ = lipZ - approach
  const cavityRoot = new Group()
  cavityRoot.name = 'waterfall-natural-cavity'

  const frameMaterial = new MeshStandardMaterial({
    color: new Color(node.rockColor).multiplyScalar(0.7),
    roughness: 0.9,
    metalness: 0,
  })
  const holeMaterial = new MeshStandardMaterial({
    color: '#17201e',
    roughness: 0.98,
    metalness: 0,
    side: DoubleSide,
  })

  const back = new Mesh(new BoxGeometry(boxWidth, boxHeight, depth), frameMaterial)
  back.name = 'waterfall-natural-cavity-box'
  back.position.set(0, centerY, sourceZ - depth * 0.42)
  back.castShadow = true
  back.receiveShadow = true
  cavityRoot.add(back)

  const hole = new Mesh(new BoxGeometry(openingWidth, openingHeight, depth * 0.12), holeMaterial)
  hole.name = 'waterfall-natural-cavity-hole'
  hole.position.set(0, centerY, sourceZ - depth * 0.94)
  hole.receiveShadow = true
  cavityRoot.add(hole)

  const bars = [
    [0, centerY - (openingHeight + frame) / 2 + frame / 2, boxWidth, frame],
    [0, centerY + (openingHeight + frame) / 2 - frame / 2, boxWidth, frame],
    [-(openingWidth + frame) / 2 + frame / 2, centerY, frame, openingHeight],
    [(openingWidth + frame) / 2 - frame / 2, centerY, frame, openingHeight],
  ] as const
  for (const [index, [x, y, width, height]] of bars.entries()) {
    const bar = new Mesh(new BoxGeometry(width, height, depth * 1.12), frameMaterial)
    bar.name = `waterfall-natural-cavity-frame-${index}`
    bar.position.set(x, y, sourceZ)
    bar.castShadow = true
    bar.receiveShadow = true
    cavityRoot.add(bar)
  }

  group.add(cavityRoot)
}

function addNaturalChannel(
  group: Group,
  node: PoolWaterfallNode,
  waterWidth: number,
  waterY: number,
  lipZ: number,
) {
  const approach = getSpillwayApproach(node.depth)
  const channelWidth = Math.max(0.2, waterWidth * 1.1)
  const channelDepth = Math.max(0.18, approach + node.lipThickness * 0.8)
  const thickness = Math.max(0.045, node.lipThickness * 0.7)
  const channel = new Mesh(
    createCurvedChannelGeometry(channelWidth, channelDepth, thickness, node.edgeCurve),
    new MeshStandardMaterial({
      color: new Color(node.rockColor).multiplyScalar(0.58),
      roughness: 0.86,
      metalness: 0,
    }),
  )
  channel.name = 'waterfall-natural-channel'
  channel.position.set(0, waterY - 0.012, lipZ - approach / 2)
  channel.castShadow = true
  channel.receiveShadow = true
  group.add(channel)
}

function createCurvedChannelGeometry(
  width: number,
  depth: number,
  thickness: number,
  edgeCurve: readonly (readonly [number, number])[],
) {
  const xSegments = Math.max(12, Math.min(40, Math.ceil(width * 8)))
  const depthSegments = Math.max(2, Math.min(4, Math.ceil(depth * 8)))
  const positions: number[] = []
  const indices: number[] = []
  const rowSize = xSegments + 1
  for (let depthIndex = 0; depthIndex <= depthSegments; depthIndex += 1) {
    const depthT = depthIndex / depthSegments
    const localZ = (depthT - 0.5) * depth
    for (let xIndex = 0; xIndex <= xSegments; xIndex += 1) {
      const x = (xIndex / xSegments - 0.5) * width
      const edgeOffset = sampleEdgeCurve(edgeCurve, x).z
      positions.push(x, 0, localZ + edgeOffset)
      positions.push(x, -thickness, localZ + edgeOffset)
    }
  }
  const verticesPerDepthRow = rowSize * 2
  for (let depthIndex = 0; depthIndex < depthSegments; depthIndex += 1) {
    for (let xIndex = 0; xIndex < xSegments; xIndex += 1) {
      const topLeft = depthIndex * verticesPerDepthRow + xIndex * 2
      const topRight = topLeft + 2
      const nextTopLeft = topLeft + verticesPerDepthRow
      const nextTopRight = nextTopLeft + 2
      const bottomLeft = topLeft + 1
      const bottomRight = topRight + 1
      const nextBottomLeft = nextTopLeft + 1
      const nextBottomRight = nextTopRight + 1
      indices.push(topLeft, nextTopLeft, topRight, topRight, nextTopLeft, nextTopRight)
      indices.push(bottomLeft, bottomRight, nextBottomLeft, bottomRight, nextBottomRight, nextBottomLeft)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
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
  // Sink the broken lower strands slightly through the receiving water. A
  // tiny overlap avoids a bright air gap from depth precision or displaced
  // pool waves while remaining hidden beneath the animated pool surface.
  const contactOverlap = node.poolId ? 0.045 : 0.03
  const geometry = createSpillwayGeometry(
    width,
    height + contactOverlap,
    getSpillwayApproach(node.depth),
    getSpillwayCurveRadius(node.sheetDepth),
    node.sheetDepth,
    node.edgeCurve,
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

  const lineEffect = new WaterfallLineEffect(node, node.flowStrength)
  const lines = new Mesh(geometry.clone(), lineEffect.material)
  lines.position.copy(water.position)
  lines.name = 'waterfall-flow-lines'
  lines.renderOrder = 4
  lines.userData.waterfallEffect = lineEffect
  group.add(lines)

  addBubbleCloud(group, width, node)
}

function bubbleRandom(seed: number, index: number, salt: number) {
  const value = Math.sin(seed * 0.017 + index * 91.173 + salt * 47.853) * 43758.5453
  return value - Math.floor(value)
}

function addBubbleCloud(group: Group, width: number, node: PoolWaterfallNode) {
  const depth = Math.max(0.3, width * 0.28)
  const layerCounts: Record<WaterfallBubbleFamily, number> = {
    foam: Math.max(9, Math.min(16, Math.round(9 + width * 3))),
    aeration: Math.max(72, Math.min(140, Math.round(76 + width * 25))),
    microstream: Math.max(18, Math.min(34, Math.round(18 + width * 7))),
  }
  let seedOffset = 0
  for (const family of ['foam', 'aeration', 'microstream'] as const) {
    const count = layerCounts[family]
    const effect = new WaterfallBubbleCloudEffect(node, node.flowStrength, family, count)
    effect.mesh.name = `waterfall-bubble-cloud-${family}`
    effect.mesh.userData.bubbleFamily = family
    effect.mesh.userData.waterfallEffect = effect
    effect.mesh.renderOrder = family === 'foam' ? 8 : family === 'microstream' ? 7 : 6
    effect.mesh.castShadow = false
    effect.mesh.receiveShadow = false

    for (let index = 0; index < count; index += 1) {
      const seedIndex = seedOffset + index
      const spread = family === 'foam' ? 0.78 : family === 'aeration' ? 1.12 : 0.66
      const xRandomA = bubbleRandom(node.rockSeed, seedIndex, 1)
      const xRandomB = bubbleRandom(node.rockSeed, seedIndex, 14)
      const x = ((xRandomA + xRandomB) * 0.5 - 0.5) * width * spread
      const across = x / Math.max(0.001, width * 0.5)
      const impact = getWaterfallImpactLocalPoint(node, across)
      const randomRadius = bubbleRandom(node.rockSeed, seedIndex, 2)
      const radius = family === 'foam'
        ? 0.04 + randomRadius * randomRadius * Math.min(0.065, width * 0.05)
        : family === 'aeration'
          ? 0.008 + randomRadius * 0.023
          : 0.011 + randomRadius * 0.018
      const zSpread = family === 'microstream' ? depth * 0.32 : family === 'foam' ? depth * 0.38 : depth
      const zBias = family === 'foam' ? 0.5 : family === 'microstream' ? 0.3 : 0.18
      const z = impact[1] + (bubbleRandom(node.rockSeed, seedIndex, 3) - zBias) * zSpread
      const familyPhase = family === 'foam' ? 0 : family === 'aeration' ? 0.28 : 0.46
      effect.addParticle({
        x,
        surfaceY: node.targetWaterOffset - 0.003
          + (bubbleRandom(node.rockSeed, seedIndex, 15) - 0.5) * (family === 'foam' ? 0.018 : 0.008),
        z,
        radius,
        phase: (familyPhase + bubbleRandom(node.rockSeed, seedIndex, 4)) % 1,
        driftX: (bubbleRandom(node.rockSeed, seedIndex, 16) - 0.5)
          * (family === 'aeration' ? 0.14 : 0.09),
        driftZ: (family === 'aeration' ? 0.045 : 0.018) + bubbleRandom(node.rockSeed, seedIndex, 6) * 0.085,
        shapeX: family === 'foam'
          ? 0.92 + bubbleRandom(node.rockSeed, seedIndex, 7) * 0.24
          : 0.84 + bubbleRandom(node.rockSeed, seedIndex, 7) * 0.32,
        shapeY: family === 'foam'
          ? 0.88 + bubbleRandom(node.rockSeed, seedIndex, 8) * 0.28
          : family === 'microstream'
            ? 1.55 + bubbleRandom(node.rockSeed, seedIndex, 8) * 1.35
            : 0.88 + bubbleRandom(node.rockSeed, seedIndex, 8) * 0.24,
        shapeZ: family === 'foam'
          ? 0.92 + bubbleRandom(node.rockSeed, seedIndex, 9) * 0.24
          : 0.86 + bubbleRandom(node.rockSeed, seedIndex, 9) * 0.3,
        wobble: (family === 'aeration' ? 0.012 : 0.006) + bubbleRandom(node.rockSeed, seedIndex, 10) * 0.018,
        frequency: 1.7 + bubbleRandom(node.rockSeed, seedIndex, 11) * 2.7,
        speedJitter: 0.72 + bubbleRandom(node.rockSeed, seedIndex, 12) * 0.62,
        tint: bubbleRandom(node.rockSeed, seedIndex, 13),
      })
    }
    seedOffset += count
    group.add(effect.mesh)
  }
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
  const cavityColor = new Color(node.structureColor).multiplyScalar(0.2)
  const cavity = new MeshStandardMaterial({ color: cavityColor, roughness: 0.96, metalness: 0 })

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

export function createSpillwayGeometry(
  width: number,
  height: number,
  approach: number,
  curveRadius: number,
  sheetDepth: number,
  edgeCurve: readonly (readonly [number, number])[] = FLAT_EDGE_CURVE,
) {
  // Pool spillover geometry and its curved-edge sampler share this row resolution.
  // Keep it stable because createSpillwayGeometry is used by both feature types.
  const xSegments = 40
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const curveLength = Math.PI * curveRadius / 2
  const verticalLength = Math.max(0.08, height - curveRadius)
  const pathLength = approach + curveLength + verticalLength
  const pathSegments = Math.max(32, Math.min(96, Math.ceil(pathLength * 28)))

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
      // Carry the pool-edge bend through the water sheet as well as the rock
      // layout. This keeps a mounted fall from looking like a straight ribbon
      // floating in front of a formation that turns around a corner.
      const edgeOffset = sampleEdgeCurve(edgeCurve, x).z
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
        pathZ + edgeOffset + normalZ * corrugation,
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

export function getWaterfallImpactLocalPoint(node: PoolWaterfallNode, across = 0): [number, number] {
  const lipZ = getWaterfallLipZ(node)
  const flowWidth = node.waterfallType === 'modern'
    ? Math.max(0.24, node.width - 0.08)
    : node.width * 0.3
  const x = Math.max(-1, Math.min(1, across)) * flowWidth * 0.5
  return [x, getSpillwayLandingZ(lipZ, node.sheetDepth) + sampleEdgeCurve(node.edgeCurve, x).z]
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

function getWaterfallLipZ(node: PoolWaterfallNode) {
  const base = node.waterfallType === 'modern' ? node.depth / 2 + node.sheetDepth : node.depth * 0.24
  return Math.max(base, node.landingInset ?? 0)
}
