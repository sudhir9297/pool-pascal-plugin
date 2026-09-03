import { BoxGeometry, CircleGeometry, CylinderGeometry, Euler, Group, Mesh, MeshStandardMaterial, TorusGeometry, Vector3 } from 'three'
import type { PoolDrainNode } from './schema'

const Y_AXIS = new Vector3(0, 1, 0)

export function getDrainPortLocalPosition(node: Pick<PoolDrainNode, 'bodyDepth'>): Vector3 {
  return new Vector3(0, -node.bodyDepth * 1.4, 0)
}

export function getDrainPortDirection(node: Pick<PoolDrainNode, 'rotation'>): Vector3 {
  return new Vector3(0, -1, 0).applyEuler(new Euler(node.rotation[0], node.rotation[1], node.rotation[2], 'XYZ')).normalize()
}

export function getDrainPortPosition(node: PoolDrainNode): Vector3 {
  return getDrainPortLocalPosition(node)
    .applyEuler(new Euler(node.rotation[0], node.rotation[1], node.rotation[2], 'XYZ'))
    .add(new Vector3(...node.position))
}

function addBox(group: Group, size: [number, number, number], position: [number, number, number], material: MeshStandardMaterial) {
  const mesh = new Mesh(new BoxGeometry(...size), material)
  mesh.position.set(...position)
  group.add(mesh)
  return mesh
}

/** Builds a recessed floor drain with a visible grate and underside outlet. */
export function buildDrainGeometry(node: PoolDrainNode): Group {
  const group = new Group()
  group.name = 'pool-drain-geometry'

  const grate = new MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.34, metalness: 0.62 })
  const edge = new MeshStandardMaterial({ color: '#94a3b8', roughness: 0.28, metalness: 0.68 })
  const dark = new MeshStandardMaterial({ color: '#1e293b', roughness: 0.58, metalness: 0.12 })

  const radius = node.grateDiameter / 2
  const thickness = Math.min(0.025, node.bodyDepth * 0.3)
  const rim = new Mesh(new TorusGeometry(radius * 0.9, Math.max(0.012, node.grateDiameter * 0.055), 10, 32), edge)
  rim.rotation.x = Math.PI / 2
  rim.position.y = thickness
  group.add(rim)

  if (node.style === 'round') {
    const plate = new Mesh(new CircleGeometry(radius * 0.86, 32), grate)
    plate.rotation.x = -Math.PI / 2
    plate.position.y = thickness + 0.002
    group.add(plate)
    for (let index = 0; index < 6; index += 1) {
      const bar = new Mesh(new BoxGeometry(radius * 1.25, 0.012, 0.012), dark)
      bar.position.y = thickness + 0.009
      bar.rotation.y = (index * Math.PI) / 6
      group.add(bar)
    }
  } else {
    const side = node.grateDiameter * 0.86
    const frame = node.grateDiameter * 0.08
    addBox(group, [side, 0.018, frame], [0, thickness + 0.008, -side / 2 + frame / 2], edge)
    addBox(group, [side, 0.018, frame], [0, thickness + 0.008, side / 2 - frame / 2], edge)
    addBox(group, [frame, 0.018, side - frame * 2], [-side / 2 + frame / 2, thickness + 0.008, 0], edge)
    addBox(group, [frame, 0.018, side - frame * 2], [side / 2 - frame / 2, thickness + 0.008, 0], edge)
    for (const x of [-side * 0.22, 0, side * 0.22]) addBox(group, [0.012, 0.02, side - frame * 2], [x, thickness + 0.01, 0], dark)
    for (const z of [-side * 0.22, 0, side * 0.22]) addBox(group, [side - frame * 2, 0.02, 0.012], [0, thickness + 0.01, z], dark)
  }

  const housing = new Mesh(new CylinderGeometry(radius * 0.78, radius * 0.68, node.bodyDepth, 24), dark)
  housing.position.y = -node.bodyDepth / 2
  group.add(housing)
  const outlet = new Mesh(new CylinderGeometry(node.diameter / 2, node.diameter / 2, node.bodyDepth * 0.5, 20), edge)
  outlet.position.y = -node.bodyDepth * 1.15
  group.add(outlet)
  const outletFace = new Mesh(new CircleGeometry(node.diameter / 2, 20), dark)
  outletFace.rotation.x = Math.PI / 2
  outletFace.position.y = -node.bodyDepth * 1.4
  group.add(outletFace)

  return group
}
