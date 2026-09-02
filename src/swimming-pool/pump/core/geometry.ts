import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
import type { PoolPumpNode } from './schema'

const Y_AXIS = new Vector3(0, 1, 0)

function addCylinder(group: Group, start: Vector3, end: Vector3, radius: number, material: MeshStandardMaterial) {
  const direction = new Vector3().subVectors(end, start)
  const mesh = new Mesh(new CylinderGeometry(radius, radius, direction.length(), 20), material)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize())
  group.add(mesh)
}

export function getPumpPortLocalPositions(node: Pick<PoolPumpNode, 'bodyDepth'>): Vector3[] {
  const portZ = node.bodyDepth / 2 + 0.16
  return [new Vector3(0, 0.09, -portZ), new Vector3(0, 0.09, portZ)]
}

export function getPumpPortPositions(node: PoolPumpNode): Vector3[] {
  const rotation = node.rotation
  const sinX = Math.sin(rotation[0]); const cosX = Math.cos(rotation[0])
  const sinY = Math.sin(rotation[1]); const cosY = Math.cos(rotation[1])
  const sinZ = Math.sin(rotation[2]); const cosZ = Math.cos(rotation[2])
  return getPumpPortLocalPositions(node).map((point) => {
    let x = point.x; let y = point.y; let z = point.z
    const y1 = y * cosX - z * sinX; const z1 = y * sinX + z * cosX
    const x2 = x * cosY + z1 * sinY; const z2 = -x * sinY + z1 * cosY
    const x3 = x2 * cosZ - y1 * sinZ; const y3 = x2 * sinZ + y1 * cosZ
    return new Vector3(x3 + node.position[0], y3 + node.position[1], z2 + node.position[2])
  })
}

/** Builds a recognizable single-stage pool pump. Port order is inlet (-Z), outlet (+Z). */
export function buildPumpGeometry(node: PoolPumpNode): Group {
  const group = new Group()
  const white = new MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.28 })
  const dark = new MeshStandardMaterial({ color: '#334155', roughness: 0.48 })
  const blue = new MeshStandardMaterial({ color: '#2563eb', roughness: 0.3 })
  const inlet = new MeshStandardMaterial({ color: '#38bdf8', roughness: 0.24 })
  const outlet = new MeshStandardMaterial({ color: '#22c55e', roughness: 0.24 })
  const r = node.diameter / 2
  const halfDepth = node.bodyDepth / 2

  const base = new Mesh(new BoxGeometry(node.bodyWidth * 0.9, 0.06, node.bodyDepth * 0.78), dark)
  base.position.y = -node.bodyHeight / 2 - 0.03
  group.add(base)
  const motor = new Mesh(new CylinderGeometry(node.bodyWidth * 0.43, node.bodyWidth * 0.43, node.bodyDepth * 0.58, 24), dark)
  motor.rotation.x = Math.PI / 2
  motor.position.set(0, node.bodyHeight * 0.15, -node.bodyDepth * 0.1)
  group.add(motor)
  const housing = new Mesh(new SphereGeometry(node.bodyWidth * 0.48, 24, 16), white)
  housing.scale.set(1, 0.9, 0.84)
  housing.position.set(0, 0.03, halfDepth * 0.22)
  group.add(housing)
  const lid = new Mesh(new CylinderGeometry(node.bodyWidth * 0.3, node.bodyWidth * 0.3, 0.035, 24), blue)
  lid.rotation.x = Math.PI / 2
  lid.position.set(0, 0.03, halfDepth * 0.62)
  group.add(lid)
  const center = new Mesh(new CylinderGeometry(node.bodyWidth * 0.07, node.bodyWidth * 0.07, 0.045, 16), dark)
  center.rotation.x = Math.PI / 2
  center.position.set(0, 0.03, halfDepth * 0.65)
  group.add(center)

  const ports = getPumpPortLocalPositions(node)
  ports.forEach((port, index) => {
    const direction = port.clone().sub(new Vector3(0, 0.09, 0)).normalize()
    addCylinder(group, direction.clone().multiplyScalar(halfDepth * 0.65), port, r * 1.7, white)
    addCylinder(group, port.clone().sub(direction.clone().multiplyScalar(0.08)), port, r * 1.95, dark)
    const face = new Mesh(new CylinderGeometry(r, r, 0.025, 20), index === 0 ? inlet : outlet)
    face.quaternion.setFromUnitVectors(Y_AXIS, direction)
    face.position.copy(port).add(direction.multiplyScalar(0.012))
    group.add(face)
  })

  const label = new Mesh(new BoxGeometry(node.bodyWidth * 0.32, 0.012, node.bodyDepth * 0.14), blue)
  label.position.set(0, node.bodyHeight * 0.48, -node.bodyDepth * 0.06)
  group.add(label)
  return group
}
