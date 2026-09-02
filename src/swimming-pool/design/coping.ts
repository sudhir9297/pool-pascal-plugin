import { BufferGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, Group, Mesh, Shape } from 'three'
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import type { PoolPoint } from '../core/schema'
import {
  layoutNaturalCopingStones,
  naturalCopingStoneCount,
  type NaturalCopingLayoutOptions,
} from './coping-layout'
import { getPoolRockColor } from './rock-colors'

export { naturalCopingStoneCount } from './coping-layout'

export type NaturalCopingOptions = NaturalCopingLayoutOptions & {
  color: string
}

export function createRockGeometry(
  length: number,
  width: number,
  height: number,
  seed: number,
) {
  // Build a deliberately flat rock: straight end faces for fitted contact,
  // an irregular outer edge, a flat top and bottom, and a small perimeter
  // bevel. The end faces are what let neighboring stones read as one border.
  const shape = new Shape()
  const variation = (index: number, amount: number) =>
    (Math.sin(seed * 0.019 + index * 2.173) * 0.5 + 0.5) * amount
  const halfLength = length * 0.5
  const inner = -width * 0.5
  const outer = (index: number) => width * (0.44 + variation(index, 0.16))
  const points: PoolPoint[] = [
    [-halfLength, inner],
    [-length * 0.18, inner - variation(1, 0.045)],
    [length * 0.22, inner - variation(2, 0.045)],
    [halfLength, inner],
    [halfLength, outer(3)],
    [length * (0.14 + variation(4, 0.2)), outer(4)],
    [length * (-0.18 + variation(5, 0.18)), outer(5)],
    [-halfLength, outer(6)],
  ]
  points.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, z)
    else shape.lineTo(x, z)
  })
  shape.closePath()

  const geometry = new ExtrudeGeometry(shape, {
    depth: height,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(0.08, Math.max(0.018, Math.min(length, width) * 0.1)),
    bevelThickness: Math.min(0.035, Math.max(0.01, height * 0.3)),
    curveSegments: 1,
  })
  // Shape coordinates use X/Y; extrusion is along local Z. Rotate it so the
  // footprint lies in the pool's X/Z plane and thickness rises on Y.
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

function createCornerRockGeometry(
  center: [number, number, number],
  tangents: [PoolPoint, PoolPoint],
  armLength: number,
  width: number,
  height: number,
) {
  const [incoming, outgoing] = tangents
  const incomingOut: PoolPoint = [incoming[1], -incoming[0]]
  const outgoingOut: PoolPoint = [outgoing[1], -outgoing[0]]
  const add = (a: PoolPoint, b: PoolPoint, distance: number): PoolPoint => [
    a[0] + b[0] * distance,
    a[1] + b[1] * distance,
  ]
  const subtract = (a: PoolPoint, b: PoolPoint, distance: number) => add(a, b, -distance)
  const corner: PoolPoint = [center[0], center[2]]
  const arm = armLength * 0.58
  const stoneWidth = width * 0.96
  const points: PoolPoint[] = [
    add(subtract(corner, incoming, arm), incomingOut, stoneWidth),
    add(corner, incomingOut, stoneWidth),
    add(corner, outgoingOut, stoneWidth),
    add(add(corner, outgoing, arm), outgoingOut, stoneWidth),
    subtract(add(corner, outgoing, arm), outgoingOut, stoneWidth),
    subtract(corner, outgoingOut, stoneWidth),
    corner,
    subtract(corner, incomingOut, stoneWidth),
    subtract(subtract(corner, incoming, arm), incomingOut, stoneWidth),
  ]
  const shape = new Shape()
  points.forEach(([x, z], index) => {
    const localX = x - center[0]
    const localZ = -(z - center[2])
    if (index === 0) shape.moveTo(localX, localZ)
    else shape.lineTo(localX, localZ)
  })
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth: height,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(0.08, Math.max(0.018, width * 0.1)),
    bevelThickness: Math.min(0.035, Math.max(0.01, height * 0.3)),
    curveSegments: 1,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

function createStoneGeometry(
  corners: [PoolPoint, PoolPoint, PoolPoint, PoolPoint],
  center: [number, number, number],
  height: number,
) {
  const positions: number[] = []
  const point = (index: number, y: number): [number, number, number] => [
    corners[index]![0] - center[0],
    y,
    corners[index]![1] - center[2],
  ]
  const triangle = (a: number[], b: number[], c: number[]) => positions.push(...a, ...b, ...c)
  const quad = (a: number[], b: number[], c: number[], d: number[]) => {
    triangle(a, b, c)
    triangle(a, c, d)
  }
  const bottom = corners.map((_, index) => point(index, 0))
  const top = corners.map((_, index) => point(index, height))
  quad(top[0]!, top[1]!, top[2]!, top[3]!)
  quad(bottom[3]!, bottom[2]!, bottom[1]!, bottom[0]!)
  for (let index = 0; index < 4; index += 1) {
    const next = (index + 1) % 4
    quad(bottom[index]!, bottom[next]!, top[next]!, top[index]!)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const xs = positions.filter((_, index) => index % 3 === 0)
  const zs = positions.filter((_, index) => index % 3 === 2)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const width = Math.max(0.001, maxX - minX)
  const depth = Math.max(0.001, maxZ - minZ)
  const uvs = new Float32Array(positions.length / 3 * 2)
  for (let index = 0; index < positions.length / 3; index += 1) {
    uvs[index * 2] = (positions[index * 3]! - minX) / width
    uvs[index * 2 + 1] = (positions[index * 3 + 2]! - minZ) / depth
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return geometry
}

/** Builds deterministic individual coping stones around a pool rim. */
export function buildNaturalCopingGeometry(
  points: PoolPoint[],
  options: NaturalCopingOptions,
) {
  const group = new Group()
  group.name = 'pool-coping'
  const baseColor = new Color(options.color)
  const layout = layoutNaturalCopingStones(points, options)

  layout.forEach((item, index) => {
    const geometry = options.rockLike
      ? item.cornerPoint && item.cornerTangents
        ? createCornerRockGeometry(item.position, item.cornerTangents, item.length, item.width, item.height)
        : createRockGeometry(item.length, item.width * 1.06, item.height, item.rockSeed)
      : createStoneGeometry(item.corners, item.position, item.height)
    const colorOffset = options.rockLike
      ? [item.colorOffset[0] * 2, item.colorOffset[1] * 1.35, item.colorOffset[2] * 1.8] as [number, number, number]
      : item.colorOffset
    const color = options.rockLike
      ? getPoolRockColor(item.rockSeed, index)
      : baseColor.clone().offsetHSL(...colorOffset)
    const material = options.rockLike
      ? new MeshStandardNodeMaterial({ color, roughness: 0.88, metalness: 0 })
      : new MeshBasicNodeMaterial({ color })
    const stone = new Mesh(geometry, material)
    stone.name = `pool-coping-stone-${index + 1}`
    stone.position.set(...item.position)
    if (options.rockLike) {
      // ExtrudeGeometry starts at the base plane, so keep the bottom flat on
      // the deck instead of lifting the stone like the previous rock volume.
      stone.position.y = 0.01
      const outward = item.cornerTangents
        ? [
            item.cornerTangents[0]![1] + item.cornerTangents[1]![1],
            -(item.cornerTangents[0]![0] + item.cornerTangents[1]![0]),
          ] as PoolPoint
        : [item.tangent[1], -item.tangent[0]] as PoolPoint
      const outwardLength = Math.hypot(outward[0], outward[1])
      if (outwardLength > 0.001) {
        const offset = 0.06
        stone.position.x += outward[0] / outwardLength * offset
        stone.position.z += outward[1] / outwardLength * offset
      }
      stone.rotation.y = item.cornerPoint && item.cornerTangents
        ? 0
        : -Math.atan2(item.tangent[1], item.tangent[0]) + item.rockRotation
    }
    group.add(stone)
  })
  return group
}
