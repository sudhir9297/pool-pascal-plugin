import {
  BoxGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { getPoolStairPreset } from '../data/catalog'
import type { PoolStairMounting } from '../design/mounting'
import type { PoolStairNode } from './schema'

function addBox(group: Group, name: string, size: [number, number, number], position: [number, number, number], material: MeshStandardMaterial) {
  const mesh = new Mesh(new BoxGeometry(...size), material)
  mesh.name = name
  mesh.position.set(...position)
  group.add(mesh)
}

function addTube(group: Group, name: string, points: Vector3[], diameter: number, material: MeshStandardMaterial) {
  const curve = new CatmullRomCurve3(points, false, 'centripetal')
  const mesh = new Mesh(new TubeGeometry(curve, 48, diameter / 2, 14, false), material)
  mesh.name = name
  group.add(mesh)
}

function addStraightTube(group: Group, from: Vector3, to: Vector3, diameter: number, material: MeshStandardMaterial) {
  const direction = to.clone().sub(from)
  const mesh = new Mesh(new CylinderGeometry(diameter / 2, diameter / 2, direction.length(), 14), material)
  mesh.position.copy(from).add(to).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize())
  group.add(mesh)
}

function addRail(group: Group, name: string, node: PoolStairNode, mounting: PoolStairMounting, x: number, material: MeshStandardMaterial) {
  const points = railPath(node, mounting, x)
  if (node.variant !== 'square') {
    addTube(group, name, points, node.tubeDiameter, material)
    return
  }
  const rail = new Group()
  rail.name = name
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    if (from && to) addStraightTube(rail, from, to, node.tubeDiameter, material)
  }
  for (const point of points.slice(1, -1)) {
    const elbow = new Mesh(new SphereGeometry(node.tubeDiameter / 2, 14, 8), material)
    elbow.position.copy(point)
    rail.add(elbow)
  }
  group.add(rail)
}

function railPath(node: PoolStairNode, mounting: PoolStairMounting, x: number): Vector3[] {
  const h = mounting.railHeight
  const outer = -mounting.deckReach
  const inner = mounting.innerOffset
  const bottom = -node.depth

  if (node.variant === 'extended') return [
    new Vector3(x, 0.02, outer), new Vector3(x, h * 0.58, outer),
    new Vector3(x, h, -0.2), new Vector3(x, h * 0.84, inner),
    new Vector3(x, h * 0.62, inner),
    new Vector3(x, bottom + 0.1, inner), new Vector3(x, bottom, inner + 0.1),
  ]

  if (node.variant === 'square') return [
    new Vector3(x, 0.02, outer), new Vector3(x, h, outer),
    new Vector3(x, h, inner), new Vector3(x, bottom, inner),
  ]

  if (node.variant === 'compact') return [
    new Vector3(x, 0.02, outer), new Vector3(x, h * 0.5, outer),
    new Vector3(x, h * 0.9, outer + 0.07), new Vector3(x, h, -0.04),
    new Vector3(x, h * 0.86, inner), new Vector3(x, h * 0.5, inner),
    new Vector3(x, bottom, inner),
  ]

  return [
    new Vector3(x, 0.02, outer), new Vector3(x, h * 0.58, outer),
    new Vector3(x, h * 0.86, outer + 0.1), new Vector3(x, h, -0.1),
    new Vector3(x, h * 0.92, inner), new Vector3(x, h * 0.68, inner),
    new Vector3(x, bottom + 0.1, inner), new Vector3(x, bottom, inner + 0.09),
  ]
}

function addDeckAnchor(group: Group, name: string, x: number, z: number, material: MeshStandardMaterial) {
  const plate = new Mesh(new CylinderGeometry(0.085, 0.085, 0.022, 24), material)
  plate.name = name
  plate.position.set(x, 0.011, z)
  group.add(plate)
  for (const boltX of [-0.042, 0.042]) {
    const bolt = new Mesh(new SphereGeometry(0.011, 10, 6), material)
    bolt.name = `${name}-bolt`
    bolt.position.set(x + boltX, 0.029, z)
    group.add(bolt)
  }
}

/** Builds the four stainless-steel wall ladders shown in the supplied photos. */
export function buildPoolStairGeometry(
  node: PoolStairNode,
  mounting: PoolStairMounting = {
    deckReach: getPoolStairPreset(node.variant).deckReach,
    innerOffset: getPoolStairPreset(node.variant).innerOffset,
    railHeight: getPoolStairPreset(node.variant).railHeight,
  },
): Group {
  const group = new Group()
  group.name = `pool-stair-${node.variant}`
  const preset = getPoolStairPreset(node.variant)
  const steel = new MeshStandardMaterial({ color: node.metalColor, metalness: 0.95, roughness: 0.14 })
  const tread = new MeshStandardMaterial({ color: node.metalColor, metalness: 0.9, roughness: 0.24 })
  const grip = new MeshStandardMaterial({ color: '#475569', metalness: 0.45, roughness: 0.62 })
  const rubber = new MeshStandardMaterial({ color: '#1f2937', roughness: 0.78 })
  const railX = node.width / 2 + node.tubeDiameter / 2

  addRail(group, 'pool-stair-left-rail', node, mounting, -railX, steel)
  addRail(group, 'pool-stair-right-rail', node, mounting, railX, steel)

  const topStepY = -0.28
  const bottomStepY = -node.depth + 0.18
  const spacing = (topStepY - bottomStepY) / Math.max(1, node.stepCount - 1)
  const treadZ = mounting.innerOffset + node.treadDepth / 2
  const treadThickness = node.variant === 'compact' ? 0.055 : 0.045
  for (let index = 0; index < node.stepCount; index += 1) {
    const y = topStepY - spacing * index
    addBox(group, `pool-stair-tread-${index + 1}`, [node.width, treadThickness, node.treadDepth], [0, y, treadZ], tread)
    for (let groove = 1; groove <= 3; groove += 1) addBox(
      group,
      `pool-stair-tread-${index + 1}-grip-${groove}`,
      [node.width * 0.82, 0.007, 0.009],
      [0, y + treadThickness / 2 + 0.004, mounting.innerOffset + node.treadDepth * groove / 4],
      grip,
    )
  }

  for (const x of [-railX, railX]) {
    addDeckAnchor(group, 'pool-stair-outer-anchor', x, -mounting.deckReach, steel)
    if (preset.fourDeckAnchors) addDeckAnchor(group, 'pool-stair-inner-anchor', x, mounting.innerOffset, steel)
    if (!preset.wallBumpers) continue
    const bumperY = -node.depth + 0.14
    addTube(
      group,
      'pool-stair-wall-standoff',
      [new Vector3(x, bumperY, mounting.innerOffset), new Vector3(x, bumperY, (mounting.innerOffset + 0.055) / 2), new Vector3(x, bumperY, 0.055)],
      node.tubeDiameter * 0.82,
      steel,
    )
    const pad = new Mesh(new CylinderGeometry(0.07, 0.07, 0.035, 20), rubber)
    pad.name = 'pool-stair-wall-bumper'
    pad.rotation.x = Math.PI / 2
    pad.position.set(x, bumperY, 0.025)
    group.add(pad)
  }
  return group
}
