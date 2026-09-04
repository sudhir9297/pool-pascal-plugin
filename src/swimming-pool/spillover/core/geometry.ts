import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { WaterfallImpactEffect, WaterfallWaterEffect } from '../../shader/waterfall-effect'
import type { PoolSpilloverNode } from './schema'

function worldPointToLocal(node: PoolSpilloverNode, point: [number, number]): [number, number] {
  const angle = node.rotation[1] ?? 0
  const dx = point[0] - node.position[0]
  const dz = point[1] - node.position[2]
  return [
    dx * Math.cos(angle) - dz * Math.sin(angle),
    dx * Math.sin(angle) + dz * Math.cos(angle),
  ]
}

function directWaterSheet(
  source: [number, number],
  target: [number, number],
  dropHeight: number,
  width: number,
) {
  const halfWidth = width / 2
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    source[0], 0, source[1] - halfWidth,
    target[0], -dropHeight, target[1] - halfWidth,
    target[0], -dropHeight, target[1] + halfWidth,
    source[0], 0, source[1] + halfWidth,
  ], 3))
  geometry.setAttribute('uv', new Float32BufferAttribute([
    0, 0,
    0, 1,
    1, 1,
    1, 0,
  ], 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.computeVertexNormals()
  return geometry
}

export function buildPoolSpilloverGeometry(node: PoolSpilloverNode) {
  const group = new Group()
  group.name = 'pool-spillover'
  const width = node.effectiveWidth ?? node.width
  const surfaceMaterial = () => new MeshStandardMaterial({ color: node.surfaceColor, roughness: 0.72 })
  const hasConnectionPath = node.connectionPath.length >= 2
  const sourceBoundary: [number, number] = hasConnectionPath
    ? worldPointToLocal(node, node.connectionPath[0]!)
    : [node.sourceSide * node.length / 2, 0]
  const targetBoundary: [number, number] = hasConnectionPath
    ? worldPointToLocal(node, node.connectionPath[1]!)
    : [node.connectionMode === 'channel' ? -node.sourceSide * node.length / 2 : 0, 0]
  const [sourceBoundaryX, sourceBoundaryZ] = sourceBoundary
  const [targetX, targetZ] = targetBoundary
  const flowDirection = Math.sign(targetX - sourceBoundaryX) || -node.sourceSide
  const sourceX = sourceBoundaryX + flowDirection * node.lipThickness / 2
  const lip = new Mesh(new BoxGeometry(node.lipThickness, node.lipThickness, width), surfaceMaterial())
  lip.name = 'pool-spillover-crest'
  lip.position.set(sourceX, -node.lipThickness / 2, sourceBoundaryZ)
  group.add(lip)

  const waterEffect = new WaterfallWaterEffect({
    shallowWaterColor: node.waterColor,
    deepWaterColor: node.waterColor,
  }, node.flowStrength)

  if (node.connectionMode === 'channel') {
    const bed = new Mesh(new BoxGeometry(node.length, node.lipThickness, width), surfaceMaterial())
    bed.name = 'pool-spillover-channel-bed'
    bed.position.y = -node.lipThickness
    bed.position.z = (sourceBoundaryZ + targetZ) / 2
    group.add(bed)

    const channelWater = new Mesh(
      new PlaneGeometry(node.length, Math.max(0.08, width - node.lipThickness * 2), 24, 8),
      waterEffect.material,
    )
    channelWater.name = 'pool-spillover-channel-water'
    channelWater.rotation.x = -Math.PI / 2
    channelWater.position.y = 0.004
    channelWater.position.z = (sourceBoundaryZ + targetZ) / 2
    channelWater.renderOrder = 3
    group.add(channelWater)

    const wallHeight = Math.max(0.18, node.lipThickness * 2)
    const wallOffset = Math.max(0, width / 2 - node.lipThickness / 2)
    const leftWall = new Mesh(new BoxGeometry(node.length, wallHeight, node.lipThickness), surfaceMaterial())
    leftWall.name = 'pool-spillover-channel-wall-left'
    leftWall.position.set(0, -wallHeight / 2 + 0.04, (sourceBoundaryZ + targetZ) / 2 - wallOffset)
    group.add(leftWall)
    const rightWall = new Mesh(new BoxGeometry(node.length, wallHeight, node.lipThickness), surfaceMaterial())
    rightWall.name = 'pool-spillover-channel-wall-right'
    rightWall.position.set(0, -wallHeight / 2 + 0.04, (sourceBoundaryZ + targetZ) / 2 + wallOffset)
    group.add(rightWall)
  }

  const sheet = new Mesh(
    node.connectionMode === 'direct'
      ? directWaterSheet(sourceBoundary, targetBoundary, node.dropHeight, width)
      : new PlaneGeometry(width, Math.max(0.02, node.dropHeight), 32, 24),
    waterEffect.material,
  )
  sheet.name = 'pool-spillover-water-sheet'
  if (node.connectionMode !== 'direct') {
    sheet.rotation.y = Math.PI / 2
    sheet.position.set(targetX, -node.dropHeight / 2, targetZ)
  }
  sheet.renderOrder = 3
  sheet.userData.waterfallEffect = waterEffect
  group.add(sheet)

  const impactEffect = new WaterfallImpactEffect(node.waterColor)
  const impactDepth = Math.max(0.12, Math.min(0.35, node.length * 0.25))
  const impact = new Mesh(new PlaneGeometry(impactDepth, width, 8, 32), impactEffect.material)
  impact.name = 'pool-spillover-impact'
  impact.rotation.x = -Math.PI / 2
  impact.position.x = targetX + flowDirection * impactDepth * 0.45
  impact.position.z = targetZ
  impact.position.y = -node.dropHeight + 0.008
  impact.renderOrder = 4
  impact.userData.waterfallEffect = impactEffect
  group.add(impact)
  group.userData.waterEffects = [waterEffect, impactEffect]
  return group
}
