import { BoxGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial } from 'three'
import type { PoolPoint } from '../../../core/schema'
import { buildNaturalCopingGeometry } from '../../../design/coping'
import type { PoolCatchBasinNode } from './schema'

export function buildCatchBasinGeometry(node: PoolCatchBasinNode) {
  const group = new Group()
  const shell = new MeshStandardMaterial({ color: node.shellColor, roughness: 0.88, side: DoubleSide })
  const water = new MeshStandardMaterial({ color: node.waterColor, roughness: 0.18, transparent: true, opacity: 0.84 })
  const floor = new Mesh(new BoxGeometry(node.length, node.wallThickness, node.width), shell)
  floor.position.y = -node.depth
  group.add(floor)

  const wallHeight = node.depth
  const sideWall = new BoxGeometry(node.wallThickness, wallHeight, node.width)
  const endWall = new BoxGeometry(node.length, wallHeight, node.wallThickness)
  const walls: Array<[BoxGeometry, [number, number, number]]> = [
    [sideWall, [-node.length / 2, -node.depth / 2, 0]],
    [sideWall, [node.length / 2, -node.depth / 2, 0]],
    [endWall, [0, -node.depth / 2, -node.width / 2]],
    [endWall, [0, -node.depth / 2, node.width / 2]],
  ]
  for (const [geometry, position] of walls) {
    const wall = new Mesh(geometry, shell)
    wall.position.set(...position)
    group.add(wall)
  }

  const surface = new Mesh(new BoxGeometry(node.length - node.wallThickness * 2, 0.035, node.width - node.wallThickness * 2), water)
  surface.position.y = -node.waterDepth
  surface.renderOrder = 1
  group.add(surface)

  const outline: PoolPoint[] = [
    [-node.length / 2, -node.width / 2],
    [node.length / 2, -node.width / 2],
    [node.length / 2, node.width / 2],
    [-node.length / 2, node.width / 2],
  ]
  const coping = buildNaturalCopingGeometry(outline, {
    width: node.copingWidth,
    thickness: node.copingThickness,
    stoneLength: node.copingStoneLength,
    jointWidth: 0.008,
    irregularity: 0.72,
    seed: node.copingSeed,
    rockLike: true,
    color: '#b8b7b0',
  })
  coping.position.y = 0
  group.add(coping)
  return group
}
