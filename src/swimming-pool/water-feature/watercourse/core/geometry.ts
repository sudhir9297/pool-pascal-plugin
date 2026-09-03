import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import type { PoolPoint } from '../../../core/schema'
import { buildSubmergedFeatureCopingGeometry } from '../../../design/feature-coping'
import type { PoolWatercourseNode } from './schema'

export function buildWatercourseGeometry(node: PoolWatercourseNode) {
  const group = new Group()
  const shell = new MeshStandardMaterial({ color: '#66716e', roughness: 0.92 })
  const channel = new Mesh(new BoxGeometry(node.length, node.channelDepth, node.width), shell)
  channel.position.y = -node.channelDepth / 2
  group.add(channel)

  const water = new Mesh(
    new BoxGeometry(node.length - node.rockWidth * 2, 0.035, Math.max(0.08, node.width - node.rockWidth * 2)),
    new MeshStandardMaterial({ color: node.waterColor, roughness: 0.16, transparent: true, opacity: 0.82 }),
  )
  water.position.set(0, -node.waterDepth, 0)
  water.rotation.z = Math.atan(node.slope)
  water.renderOrder = 1
  group.add(water)

  const halfWidth = node.width / 2
  const left: PoolPoint = [-node.length / 2, -halfWidth + node.rockWidth / 2]
  const leftEnd: PoolPoint = [node.length / 2, -halfWidth + node.rockWidth / 2]
  const right: PoolPoint = [-node.length / 2, halfWidth - node.rockWidth / 2]
  const rightEnd: PoolPoint = [node.length / 2, halfWidth - node.rockWidth / 2]
  for (const [start, end, seed] of [[left, leftEnd, node.rockSeed], [right, rightEnd, node.rockSeed + 1]] as const) {
    const rocks = buildSubmergedFeatureCopingGeometry(start, end, {
      width: node.rockWidth,
      thickness: Math.min(0.2, node.channelDepth * 0.55),
      stoneLength: 0.55,
      irregularity: 0.7,
      seed,
      color: node.rockColor,
      topDepth: 0.02,
    })
    rocks.position.y = -node.channelDepth * 0.18
    group.add(rocks)
  }
  return group
}
