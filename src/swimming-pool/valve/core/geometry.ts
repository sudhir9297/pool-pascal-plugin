import { BoxGeometry, CylinderGeometry, Euler, Group, Mesh, MeshStandardMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import type { PoolValveNode } from './schema'

const AXIS = new Vector3(0, 1, 0)

function addCylinder(group: Group, start: Vector3, end: Vector3, radius: number, material: MeshStandardMaterial) {
  const direction = new Vector3().subVectors(end, start)
  const mesh = new Mesh(new CylinderGeometry(radius, radius, direction.length(), 20), material)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(AXIS, direction.normalize())
  group.add(mesh)
}

/** Local +Z and -Z are the straight-through ports; +X is the horizontal 3-way branch. */
export function getValvePortLocalPositions(node: Pick<PoolValveNode, 'variant'>): Vector3[] {
  return node.variant === 'two-way'
    ? [new Vector3(0, 0, -0.28), new Vector3(0, 0, 0.28)]
    : [new Vector3(0, 0, -0.28), new Vector3(0, 0, 0.28), new Vector3(0.28, 0, 0)]
}

export function getValvePortPositions(node: PoolValveNode): Vector3[] {
  const local = getValvePortLocalPositions(node)
  const rotation = new Euler(node.rotation[0], node.rotation[1], node.rotation[2])
  return local.map((point) => point.applyEuler(rotation).add(new Vector3(...node.position)))
}

/** Port order is -Z, +Z, +X. The T-port ball exposes one of the four common flow patterns. */
export function getValveOpenPortIndices(node: PoolValveNode): Set<number> {
  if (node.variant === 'two-way') return node.flowPattern === 'open' ? new Set([0, 1]) : new Set()
  switch (node.flowPattern) {
    case 'left-right': return new Set([0, 1])
    case 'left-branch': return new Set([0, 2])
    case 'right-branch': return new Set([1, 2])
    case 'all': return new Set([0, 1, 2])
    default: return new Set([0, 1, 2])
  }
}

export function buildValveGeometry(node: PoolValveNode): Group {
  const group = new Group()
  const pvc = new MeshStandardMaterial({ color: '#dbeafe', roughness: 0.28 })
  const union = new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.2 })
  const dark = new MeshStandardMaterial({ color: '#64748b', roughness: 0.36 })
  const openSocket = new MeshStandardMaterial({ color: '#60a5fa', roughness: 0.24 })
  const closedSocket = new MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.34 })
  const handleMaterial = new MeshStandardMaterial({ color: '#f97316', roughness: 0.32 })
  const r = node.bodyRadius
  const socketRadius = node.diameter / 2
  const body = new Mesh(new SphereGeometry(r, 24, 16), pvc)
  group.add(body)

  const ports = getValvePortLocalPositions(node)
  const openPorts = getValveOpenPortIndices(node)
  for (const [index, port] of ports.entries()) {
    const direction = port.clone().normalize()
    addCylinder(group, direction.clone().multiplyScalar(r * 0.55), port, r * 0.64, pvc)
    const collarStart = port.clone().multiplyScalar(0.92)
    const collarEnd = port.clone().multiplyScalar(1.12)
    addCylinder(group, collarStart, collarEnd, r * 0.82, union)
    const socket = new Mesh(new CylinderGeometry(socketRadius, socketRadius, 0.025, 20), openPorts.has(index) ? openSocket : closedSocket)
    socket.quaternion.setFromUnitVectors(AXIS, direction)
    socket.position.copy(port).add(direction.multiplyScalar(0.012))
    group.add(socket)
  }

  const bonnet = new Mesh(new CylinderGeometry(r * 0.38, r * 0.38, r * 0.55, 20), pvc)
  bonnet.position.y = r * 1.12
  group.add(bonnet)
  const stem = new Mesh(new CylinderGeometry(r * 0.14, r * 0.14, r * 0.62, 16), handleMaterial)
  stem.position.y = r * 1.48
  group.add(stem)
  const handle = new Mesh(new BoxGeometry(r * 1.8, r * 0.18, r * 0.34), handleMaterial)
  handle.position.y = r * 1.78
  handle.rotation.y = node.handleAngle
  group.add(handle)
  const indicator = new Mesh(new TorusGeometry(r * 0.44, r * 0.035, 8, 20), dark)
  indicator.rotation.x = Math.PI / 2
  indicator.position.y = r * 1.08
  group.add(indicator)
  return group
}
