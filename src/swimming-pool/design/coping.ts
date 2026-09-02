import { BufferGeometry, Color, Float32BufferAttribute, Group, Mesh } from 'three'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import type { PoolPoint } from '../core/schema'
import {
  layoutNaturalCopingStones,
  naturalCopingStoneCount,
  type NaturalCopingLayoutOptions,
} from './coping-layout'

export { naturalCopingStoneCount } from './coping-layout'

export type NaturalCopingOptions = NaturalCopingLayoutOptions & {
  color: string
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
    const geometry = createStoneGeometry(item.corners, item.position, item.height)
    const color = baseColor.clone().offsetHSL(...item.colorOffset)
    const material = new MeshBasicNodeMaterial({ color })
    const stone = new Mesh(geometry, material)
    stone.name = `pool-coping-stone-${index + 1}`
    stone.position.set(...item.position)
    group.add(stone)
  })
  return group
}
