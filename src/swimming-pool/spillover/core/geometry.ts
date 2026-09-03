import { BoxGeometry, CircleGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { WaterfallImpactEffect, WaterfallWaterEffect } from '../../shader/waterfall-effect'
import type { PoolSpilloverNode } from './schema'

export function buildPoolSpilloverGeometry(node: PoolSpilloverNode) {
  const group = new Group()
  group.name = 'pool-spillover'
  const sourceX = node.sourceSide * Math.max(0, node.length / 2 - node.lipThickness / 2)
  const lip = new Mesh(new BoxGeometry(node.lipThickness, node.lipThickness, node.width), new MeshStandardMaterial({ color: node.surfaceColor, roughness: 0.72 }))
  lip.name = 'pool-spillover-crest'
  lip.position.set(sourceX, -node.lipThickness / 2, 0)
  group.add(lip)

  const waterEffect = new WaterfallWaterEffect({
    shallowWaterColor: node.waterColor,
    deepWaterColor: node.waterColor,
  }, node.flowStrength)
  const sheet = new Mesh(new PlaneGeometry(node.width, Math.max(0.02, node.dropHeight), 32, 24), waterEffect.material)
  sheet.name = 'pool-spillover-water-sheet'
  sheet.rotation.y = Math.PI / 2
  sheet.position.set(0, -node.dropHeight / 2, 0)
  sheet.renderOrder = 3
  sheet.userData.waterfallEffect = waterEffect
  group.add(sheet)

  const impactEffect = new WaterfallImpactEffect(node.waterColor)
  const impact = new Mesh(new CircleGeometry(Math.max(0.16, node.width * 0.22), 48), impactEffect.material)
  impact.name = 'pool-spillover-impact'
  impact.rotation.x = -Math.PI / 2
  impact.position.y = -node.dropHeight + 0.008
  impact.renderOrder = 4
  impact.userData.waterfallEffect = impactEffect
  group.add(impact)
  group.userData.waterEffects = [waterEffect, impactEffect]
  return group
}
