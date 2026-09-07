import { sampleSpilloverEdge } from '../design/curved-placement'
import { BoxGeometry, type BufferGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { WaterfallWaterEffect, type WaterfallWaterStyle } from '../../shader/waterfall-effect'
import { createSpillwayGeometry } from '../../water-feature/waterfall/core/geometry'
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

function deformGeometry(geometry: BufferGeometry, offset: (x: number, y: number, z: number) => [number, number, number]) {
  const position = geometry.getAttribute('position')
  for (let index = 0; index < position.count; index++) {
    position.setXYZ(index, ...offset(position.getX(index), position.getY(index), position.getZ(index)))
  }
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

export function buildPoolSpilloverGeometry(node: PoolSpilloverNode, waterStyle?: WaterfallWaterStyle) {
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
  // Overlapping boundary points can be reversed; flow follows the pools,
  // not the sign of the gap between their rims.
  const flowDirection = -node.sourceSide
  const landingInset = Math.max(node.landingInset ?? 0,
    flowDirection * (sourceBoundaryX - targetX) + node.lipThickness)
  const channelLength = Math.max(node.lipThickness, flowDirection * (targetX - sourceBoundaryX) + landingInset)
  const channelCenter = (sourceBoundaryX + targetX + flowDirection * landingInset) / 2
  const sourceX = sourceBoundaryX + flowDirection * node.lipThickness / 2
  const lip = new Mesh(new BoxGeometry(node.lipThickness, node.lipThickness, width, 1, 1, 40), surfaceMaterial())
  deformGeometry(lip.geometry, (x, y, z) => [x + sampleSpilloverEdge(node.sourceEdge, z), y, z])
  lip.name = 'pool-spillover-crest'
  lip.position.set(sourceX, -node.lipThickness / 2, sourceBoundaryZ)
  group.add(lip)

  const waterEffect = new WaterfallWaterEffect(waterStyle ?? {
    shallowWaterColor: node.waterColor,
    deepWaterColor: node.waterColor,
  }, node.flowStrength, 0.25)

  if (node.connectionMode === 'channel') {
    const bed = new Mesh(new BoxGeometry(channelLength, node.lipThickness, width, 1, 1, 40), surfaceMaterial())
    const channelOffset = (x: number, z: number) => {
      const t = Math.max(0, Math.min(1, (x + channelCenter - sourceBoundaryX) / (targetX + flowDirection * landingInset - sourceBoundaryX || 1)))
      return sampleSpilloverEdge(node.sourceEdge, z) * (1 - t) + sampleSpilloverEdge(node.targetEdge, z) * t
    }
    deformGeometry(bed.geometry, (x, y, z) => [x + channelOffset(x, z), y, z])
    bed.name = 'pool-spillover-channel-bed'
    bed.position.x = channelCenter
    bed.position.y = -node.lipThickness
    bed.position.z = (sourceBoundaryZ + targetZ) / 2
    group.add(bed)

    const wallHeight = Math.max(0.18, node.lipThickness * 2)
    const wallOffset = Math.max(0, width / 2 - node.lipThickness / 2)
    const leftWall = new Mesh(new BoxGeometry(channelLength, wallHeight, node.lipThickness), surfaceMaterial())
    deformGeometry(leftWall.geometry, (x, y, z) => [x + channelOffset(x, z - wallOffset), y, z])
    leftWall.name = 'pool-spillover-channel-wall-left'
    leftWall.position.set(channelCenter, -wallHeight / 2 + 0.04, (sourceBoundaryZ + targetZ) / 2 - wallOffset)
    group.add(leftWall)
    const rightWall = new Mesh(new BoxGeometry(channelLength, wallHeight, node.lipThickness), surfaceMaterial())
    deformGeometry(rightWall.geometry, (x, y, z) => [x + channelOffset(x, z + wallOffset), y, z])
    rightWall.name = 'pool-spillover-channel-wall-right'
    rightWall.position.set(channelCenter, -wallHeight / 2 + 0.04, (sourceBoundaryZ + targetZ) / 2 + wallOffset)
    group.add(rightWall)
  }

  // Use one continuous approach, rounded lip, and curtain, with enough
  // clearance for the waterfall mesh's corrugation above the solid crest.
  const waterClearance = 0.024
  const sheetDepth = Math.min(0.025, node.dropHeight * 0.15)
  const curveRadius = Math.min(Math.max(0.08, node.lipThickness), node.dropHeight * 0.4)
  const approach = Math.max(node.lipThickness, flowDirection * (targetX - sourceBoundaryX) + landingInset)
  const sheetGeometry = createSpillwayGeometry(
    node.connectionMode === 'channel' ? Math.max(0.08, width - node.lipThickness * 2) : width,
    node.dropHeight + waterClearance + 0.045,
    approach,
    curveRadius,
    sheetDepth,
  )
  deformGeometry(sheetGeometry, (x, y, z) => {
    const across = -flowDirection * x
    const t = Math.max(0, Math.min(1, (z + approach) / approach))
    const offset = sampleSpilloverEdge(node.sourceEdge, across) * (1 - t)
      + sampleSpilloverEdge(node.targetEdge, across) * t
    return [x, y, z + flowDirection * offset + landingInset]
  })
  const sheet = new Mesh(sheetGeometry, waterEffect.material)
  sheet.name = 'pool-spillover-water-sheet'
  sheet.rotation.y = flowDirection * Math.PI / 2
  sheet.position.set(targetX, waterClearance, targetZ)
  sheet.renderOrder = 3
  sheet.userData.waterfallEffect = waterEffect
  group.add(sheet)

  group.userData.waterEffects = [waterEffect]
  return group
}
