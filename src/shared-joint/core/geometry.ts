import { BoxGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape } from 'three'
import { PoolWaterEffect } from '../../shader/water-effect'
import type { PoolSharedJointNode } from './schema'

function createTransitionShelfGeometry(length: number, width: number, height: number) {
  const shape = new Shape()
  const halfLength = length / 2
  const halfWidth = width / 2
  const radius = Math.min(0.16, length / 4, width / 4)
  shape.moveTo(-halfLength + radius, -halfWidth)
  shape.lineTo(halfLength - radius, -halfWidth)
  shape.absarc(halfLength - radius, -halfWidth + radius, radius, -Math.PI / 2, 0, false)
  shape.lineTo(halfLength, halfWidth - radius)
  shape.absarc(halfLength - radius, halfWidth - radius, radius, 0, Math.PI / 2, false)
  shape.lineTo(-halfLength + radius, halfWidth)
  shape.absarc(-halfLength + radius, halfWidth - radius, radius, Math.PI / 2, Math.PI, false)
  shape.lineTo(-halfLength, -halfWidth + radius)
  shape.absarc(-halfLength + radius, -halfWidth + radius, radius, Math.PI, Math.PI * 1.5, false)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth: height,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(0.04, height * 0.22),
    bevelThickness: Math.min(0.03, height * 0.18),
    curveSegments: 4,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

function localIntersectionRegion(node: PoolSharedJointNode, region: [number, number][]) {
  const rotation = node.rotation[1] ?? 0
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  return region.map(([worldX, worldZ]) => {
    const dx = worldX - node.position[0]
    const dz = worldZ - node.position[2]
    return [dx * cos - dz * sin, dx * sin + dz * cos] as [number, number]
  })
}

function createRegionExtrusion(region: [number, number][], height: number, bevel: boolean) {
  const shape = new Shape()
  region.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, -z)
    else shape.lineTo(x, -z)
  })
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth: height,
    steps: 1,
    bevelEnabled: bevel,
    bevelSegments: bevel ? 2 : 0,
    bevelSize: bevel ? Math.min(0.04, height * 0.22) : 0,
    bevelThickness: bevel ? Math.min(0.03, height * 0.18) : 0,
    curveSegments: bevel ? 4 : 1,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

function buildConnectionFootprint(
  node: PoolSharedJointNode,
  name: string,
  height: number,
  y: number,
  color: string,
  bevel: boolean,
  waterEffect?: PoolWaterEffect,
) {
  const group = new Group()
  group.name = name
  const regions = node.intersection.length > 0
    ? node.intersection.map((region) => localIntersectionRegion(node, region))
    : []
  if (regions.length === 0) {
    const fallback = new Mesh(
      name === 'pool-connection-water-passage'
        ? new BoxGeometry(node.length, height, Math.max(0.08, node.width - node.rockWidth * 2))
        : createTransitionShelfGeometry(node.length, Math.max(0.08, node.width - node.rockWidth * 2), height),
      waterEffect?.material ?? new MeshStandardMaterial({ color, transparent: name.includes('water'), opacity: name.includes('water') ? 0.72 : 1, roughness: 0.82, metalness: 0 }),
    )
    fallback.position.y = y
    group.add(fallback)
    return group
  }
  regions.forEach((region) => {
    if (region.length < 3) return
    const mesh = new Mesh(
      createRegionExtrusion(region, height, bevel),
      waterEffect?.material ?? new MeshStandardMaterial({ color, transparent: name.includes('water'), opacity: name.includes('water') ? 0.72 : 1, roughness: 0.82, metalness: 0 }),
    )
    mesh.position.y = y
    group.add(mesh)
  })
  return group
}

function buildCommonFloor(node: PoolSharedJointNode) {
  const group = new Group()
  group.name = 'pool-connection-common-floor'
  const rotation = node.rotation[1] ?? 0
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  for (const region of node.intersection) {
    if (region.length < 3) continue
    const shape = new Shape()
    region.forEach(([worldX, worldZ], index) => {
      const dx = worldX - node.position[0]
      const dz = worldZ - node.position[2]
      const localX = dx * cos - dz * sin
      const localZ = dx * sin + dz * cos
      if (index === 0) shape.moveTo(localX, -localZ)
      else shape.lineTo(localX, -localZ)
    })
    shape.closePath()
    const floor = new Mesh(
      new ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false }),
      new MeshStandardMaterial({ color: '#23798c', roughness: 0.76, metalness: 0 }),
    )
    floor.name = 'pool-connection-common-floor-region'
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -node.commonFloorDepth
    group.add(floor)
  }
  return group
}

export function buildSharedJointGeometry(node: PoolSharedJointNode) {
  const group = new Group()
  // The pools remain independent. This module owns only the narrow transition
  // between them: shared rocks, a water passage, and an optional submerged shelf.
  const waterEffect = new PoolWaterEffect({
    waterPreset: 'crystal-clear',
    waterColor: '#168ca8',
    shallowWaterColor: '#38bdf8',
    deepWaterColor: '#08718f',
    reflectionStrength: 0.32,
    refractionStrength: 0.08,
    causticsStrength: 0.18,
    shorelineStrength: 0.15,
  })
  group.userData.waterEffect = waterEffect
  group.add(buildCommonFloor(node))
  group.add(buildConnectionFootprint(node, 'pool-connection-water-passage', 0.025, -0.12, '#168ca8', false, waterEffect))

  if (node.copingStyle === 'continuous') {
    group.add(buildConnectionFootprint(
      node,
      'pool-connection-continuous-border',
      node.thickness,
      0.01,
      node.surfaceColor,
      false,
    ))
  }

  if (node.connectionMode === 'submerged-shelf' || node.connectionMode === 'spillover') {
    const shelfName = node.connectionMode === 'spillover'
      ? 'pool-connection-spillover-dam'
      : 'pool-connection-submerged-shelf'
    group.add(buildConnectionFootprint(node, shelfName, node.transitionHeight, -node.transitionDepth, node.transitionColor, true))
  }
  return group
}
