import { sampleSpilloverEdge } from '../design/curved-placement'
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, ShapeUtils, Vector2, Group, Mesh, MeshStandardMaterial } from 'three'
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

function buildOverlapSurfaceGeometry(node: PoolSpilloverNode) {
  const positions: number[] = []
  for (const region of node.intersection) {
    const local = region.map((point) => worldPointToLocal(node, point))
    const triangles = ShapeUtils.triangulateShape(local.map(([x, z]) => new Vector2(x, z)), [])
    for (const triangle of triangles) {
      for (const index of triangle) {
        const point = local[index]!
        positions.push(point[0], 0, point[1])
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
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
  const [rawTargetX, targetZ] = targetBoundary
  // Overlapping boundary points can be reversed; flow follows the pools,
  // not the sign of the gap between their rims.
  const baseLandingInset = node.landingInset ?? 0
  const overlapReach = node.connectionMode === 'overlap'
    ? Math.max(0.28, Math.min(0.45, baseLandingInset + 0.16))
    : 0
  const targetX = node.connectionMode === 'overlap'
    ? sourceBoundaryX + (-node.sourceSide) * overlapReach
    : rawTargetX
  // The local X coordinates are already expressed in the spillover's frame.
  // Derive the path direction from the two resolved endpoints so reversing
  // the source/target pools cannot collapse the approach or flip it past the
  // receiving pool.
  const pathDirection = Math.sign(targetX - sourceBoundaryX) || -node.sourceSide || 1
  const edgeDirection = -node.sourceSide
  const landingInset = Math.max(baseLandingInset,
    Math.abs(targetX - sourceBoundaryX) + node.lipThickness)
  const touchingConnection = node.connectionMode === 'channel' && node.length <= 0.2
  // Keep separated-pool water within the platform gap. Rock coping may need a
  // little receiving clearance, but it must not stretch the visible sheet by
  // the full coping-dependent inset.
  const waterLandingInset = node.connectionMode === 'overlap'
    ? landingInset
    : 0
  // Landing inset extends only the water curtain into the receiving basin;
  // the solid platform and its borders remain exactly the measured gap.
  const channelLength = Math.max(node.lipThickness, Math.abs(targetX - sourceBoundaryX))
  const channelCenter = (sourceBoundaryX + targetX) / 2
  const sourceX = sourceBoundaryX + pathDirection * node.lipThickness / 2
  const lip = new Mesh(new BoxGeometry(node.lipThickness, node.lipThickness, width, 1, 1, 40), surfaceMaterial())
  deformGeometry(lip.geometry, (x, y, z) => [x + sampleSpilloverEdge(node.sourceEdge, z), y, z])
  lip.name = 'pool-spillover-crest'
  lip.position.set(sourceX, -node.lipThickness / 2, sourceBoundaryZ)
  group.add(lip)

  const waterEffect = new WaterfallWaterEffect(waterStyle ?? {
    shallowWaterColor: node.waterColor,
    deepWaterColor: node.waterColor,
  }, node.flowStrength, 0.25)

  const hasResolvedOverlap = node.connectionMode === 'overlap'
    && node.intersection.length > 0
    && node.connectionPath.length >= 2
  if (node.connectionMode === 'overlap') {
    const exactIntersection = node.intersection.length > 0
    const surfaceGeometry = exactIntersection
      ? buildOverlapSurfaceGeometry(node)
      : new BoxGeometry(channelLength, node.lipThickness, width, 1, 1, 40)
    const surface = new Mesh(surfaceGeometry, surfaceMaterial())
    if (!exactIntersection) deformGeometry(surface.geometry, (x, y, z) => [
      x + sampleSpilloverEdge(node.sourceEdge, z), y, z,
    ])
    surface.name = 'pool-spillover-overlap-surface'
    surface.position.y = -node.lipThickness
    if (!exactIntersection) surface.position.set(channelCenter, -node.lipThickness, (sourceBoundaryZ + targetZ) / 2)
    group.add(surface)
    if (!exactIntersection) {
      const wallHeight = Math.max(0.22, node.lipThickness * 3)
      const wallOffset = Math.max(0, width / 2 - node.lipThickness / 2)
      const wallInset = Math.max(0.025, node.lipThickness * 0.5)
      for (const side of [-1, 1] as const) {
        const wall = new Mesh(new BoxGeometry(channelLength, wallHeight, node.lipThickness), surfaceMaterial())
        wall.name = `pool-spillover-overlap-wall-${side < 0 ? 'left' : 'right'}`
        wall.position.set(
          channelCenter,
          -node.lipThickness / 2 + wallHeight / 2 + 0.001,
          (sourceBoundaryZ + targetZ) / 2 + side * Math.max(0, wallOffset - wallInset),
        )
        group.add(wall)
      }
    }
  }

  if (node.connectionMode === 'channel') {
    const bed = new Mesh(new BoxGeometry(channelLength, node.lipThickness, width, 1, 1, 40), surfaceMaterial())
    const channelOffset = (x: number, z: number) => {
      const span = targetX - sourceBoundaryX || 1
      const t = Math.max(0, Math.min(1, (x + channelCenter - sourceBoundaryX) / span))
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
    // Keep the vertical side walls on the same footprint as the outer
    // borders below. This places each wall directly over its matching rail
    // instead of leaving it inset toward the water channel.
    leftWall.position.set(channelCenter, -node.lipThickness / 2 + wallHeight / 2 + 0.001, (sourceBoundaryZ + targetZ) / 2 - wallOffset)
    group.add(leftWall)
    const rightWall = new Mesh(new BoxGeometry(channelLength, wallHeight, node.lipThickness), surfaceMaterial())
    deformGeometry(rightWall.geometry, (x, y, z) => [x + channelOffset(x, z + wallOffset), y, z])
    rightWall.name = 'pool-spillover-channel-wall-right'
    rightWall.position.set(channelCenter, -node.lipThickness / 2 + wallHeight / 2 + 0.001, (sourceBoundaryZ + targetZ) / 2 + wallOffset)
    group.add(rightWall)
    // The measured channel stops at the pool wall centerlines. Extend only
    // the visible side borders into the coping so no seam remains between the
    // spillover rail and rock/continuous pool borders. The floor opening and
    // water sheet retain the exact endpoint-to-endpoint length.
    const borderLength = channelLength + node.lipThickness * 2 + 0.04
    for (const side of [-1, 1] as const) {
      const border = new Mesh(new BoxGeometry(borderLength, node.lipThickness, node.lipThickness), surfaceMaterial())
      border.name = `pool-spillover-channel-outer-border-${side < 0 ? 'left' : 'right'}`
      border.position.set(
        channelCenter,
        0.001,
        // Align the border's outside face with the outside edge of the
        // spillover opening. The containment walls stay slightly inset to
        // avoid coplanar overlap, while this visible rectangular rail closes
        // the seam to the pool coping.
        (sourceBoundaryZ + targetZ) / 2 + side * wallOffset,
      )
      group.add(border)
    }
  }

  // Use one continuous approach, rounded lip, and curtain, with enough
  // clearance for the waterfall mesh's corrugation above the solid crest.
  const waterClearance = 0.031
  const sheetDepth = Math.min(0.025, node.dropHeight * 0.15)
  const curveRadius = Math.min(0.04, node.dropHeight * 0.4)
  const pathDistance = Math.abs(targetX - sourceBoundaryX) + waterLandingInset
  // In an overlap, the lower rim can lie behind the higher rim along the
  // flow axis. The normal gap calculation then collapses the sheet to the
  // lip, so give it a short outward run into the receiving basin. Separated
  // channels continue to use their measured rim-to-rim distance.
  const approach = touchingConnection
    ? node.lipThickness
    : Math.max(node.lipThickness, pathDistance - curveRadius, overlapReach)
  const sheetGeometry = createSpillwayGeometry(
    // Let the water reach both platform edges. The side walls sit beneath
    // those edges and provide the containment instead of narrowing the sheet.
    width,
    node.dropHeight + waterClearance + 0.045,
    approach,
    curveRadius,
    sheetDepth,
  )
  deformGeometry(sheetGeometry, (x, y, z) => {
    const across = -pathDirection * x
    const t = Math.max(0, Math.min(1, (z + approach) / approach))
    const offset = sampleSpilloverEdge(node.sourceEdge, across) * (1 - t)
      + sampleSpilloverEdge(node.targetEdge, across) * t
    // The waterfall helper's curve advances one radius in local Z. Flatten
    // that small forward offset at the lip so the falling edge meets the
    // receiving rim instead of stopping short of it.
    const curveCorrection = z > 0 ? Math.min(curveRadius, z) : 0
    return [x, y, z - curveCorrection + edgeDirection * offset + waterLandingInset]
  })
  const sheet = new Mesh(sheetGeometry, waterEffect.material)
  sheet.name = 'pool-spillover-water-sheet'
  sheet.rotation.y = pathDirection * Math.PI / 2
  // The generated path finishes one curve radius beyond its local origin.
  // Shift the local path so its endpoint lands exactly on the resolved
  // receiving edge while keeping the node's stored endpoint position stable.
  sheet.position.set(targetX, waterClearance, targetZ)
  sheet.renderOrder = 3
  sheet.userData.waterfallEffect = waterEffect
  if (!hasResolvedOverlap) group.add(sheet)

  group.userData.waterEffects = [waterEffect]
  return group
}
