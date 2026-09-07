import { CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import type { PoolValveNode } from './schema'

const AXIS = new Vector3(0, 1, 0)

function addCylinder(group: Group, start: Vector3, end: Vector3, radius: number, material: MeshStandardMaterial) {
  const direction = new Vector3().subVectors(end, start)
  const mesh = new Mesh(new CylinderGeometry(radius, radius, direction.length(), 20), material)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(AXIS, direction.normalize())
  group.add(mesh)
}

/** The 3-way body is a horizontal T: left, right, and a common front port. */
function getValvePortLocalPositions(node: Pick<PoolValveNode, 'variant'>): Vector3[] {
  return node.variant === 'two-way'
    ? [new Vector3(0, 0, -0.28), new Vector3(0, 0, 0.28)]
    : [new Vector3(-0.28, 0, 0), new Vector3(0.28, 0, 0), new Vector3(0, 0, -0.28)]
}

/**
 * Valve sockets are bidirectional connection points. The selected flow
 * pattern describes the ball's internal path for visualization/operation; it
 * must never decide whether a pipe may attach to a socket.
 */
export function getValveConnectionPortIndices(node: PoolValveNode): number[] {
  return getValvePortLocalPositions(node).map((_, index) => index)
}

/** Port order is -Z, +Z, +X. The T-port ball exposes one of the four common flow patterns. */
export function getValveOpenPortIndices(node: PoolValveNode): Set<number> {
  if (node.variant === 'two-way') return node.flowPattern === 'open' ? new Set([0, 1]) : new Set()
  switch (node.flowPattern) {
    case 'left-right': return new Set([0, 1])
    case 'left-branch': return new Set([0, 2])
    case 'right-branch': return new Set([1, 2])
    case 'all': return new Set([0, 1, 2])
    case 'open': return new Set([0, 1, 2])
    default: return new Set()
  }
}

export function getValveFlowPairs(node: PoolValveNode): Array<[number, number]> {
  if (node.variant === 'two-way') return node.flowPattern === 'open' ? [[0, 1]] : []
  switch (node.flowPattern) {
    case 'left-right': return [[0, 1]]
    case 'left-branch': return [[0, 2]]
    case 'right-branch': return [[1, 2]]
    case 'all':
    case 'open': return [[0, 1], [0, 2], [1, 2]]
    default: return []
  }
}

export function buildValveGeometry(node: PoolValveNode): Group {
  const group = new Group()
  const pvc = new MeshStandardMaterial({ color: '#dbeafe', roughness: 0.28 })
  const union = new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.2 })
  const dark = new MeshStandardMaterial({ color: '#64748b', roughness: 0.36 })
  const openSocket = new MeshStandardMaterial({ color: '#60a5fa', roughness: 0.24 })
  const closedSocket = new MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.34 })
  const flowMaterial = new MeshStandardMaterial({ color: '#22d3ee', emissive: '#0891b2', emissiveIntensity: 0.8, roughness: 0.2 })
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
    const socketMaterial = openPorts.has(index) ? openSocket : closedSocket
    socketMaterial.emissive = openPorts.has(index) ? openSocket.color : closedSocket.color
    socketMaterial.emissiveIntensity = openPorts.has(index) ? 0.5 : 0.05
    const socket = new Mesh(new CylinderGeometry(socketRadius, socketRadius, 0.025, 20), socketMaterial)
    socket.quaternion.setFromUnitVectors(AXIS, direction)
    socket.position.copy(port).add(direction.multiplyScalar(0.012))
    group.add(socket)
  }

  // A bright internal channel makes the selected flow pattern readable from
  // the outside instead of relying on a tiny socket color change.
  const flowPairs = getValveFlowPairs(node)
  for (const [fromIndex, toIndex] of flowPairs) {
    const from = ports[fromIndex]
    const to = ports[toIndex]
    if (!from || !to) continue
    addCylinder(group, from.clone().normalize().multiplyScalar(r * 0.18), to.clone().normalize().multiplyScalar(r * 0.18), r * 0.14, flowMaterial)
  }

  const bonnet = new Mesh(new CylinderGeometry(r * 0.38, r * 0.38, r * 0.55, 20), pvc)
  bonnet.position.y = r * 1.12
  group.add(bonnet)
  const stem = new Mesh(new CylinderGeometry(r * 0.14, r * 0.14, r * 0.62, 16), handleMaterial)
  stem.position.y = r * 1.48
  group.add(stem)
  const lever = new Group()
  lever.rotation.y = node.handleAngle
  // One continuous beveled profile gives the handle the molded, slightly
  // raised L shape of a real pool valve instead of looking like loose blocks.
  const leverShape = new Shape()
  leverShape.moveTo(0, 0)
  leverShape.lineTo(r * 0.2, 0)
  leverShape.lineTo(r * 0.46, r * 0.2)
  leverShape.lineTo(r * 1.62, r * 0.2)
  leverShape.lineTo(r * 1.9, r * 0.12)
  leverShape.lineTo(r * 1.9, -r * 0.1)
  leverShape.lineTo(r * 0.34, -r * 0.1)
  leverShape.lineTo(r * 0.08, -r * 0.18)
  leverShape.closePath()
  const leverDepth = r * 0.34
  const leverGeometry = new ExtrudeGeometry(leverShape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: r * 0.035,
    bevelThickness: r * 0.035,
    curveSegments: 4,
    depth: leverDepth,
  })
  leverGeometry.translate(0, r * 1.78, -leverDepth / 2)
  lever.add(new Mesh(leverGeometry, handleMaterial))
  const leverPivotCap = new Mesh(new CylinderGeometry(r * 0.28, r * 0.28, r * 0.1, 20), handleMaterial)
  leverPivotCap.position.set(0, r * 1.82, 0)
  lever.add(leverPivotCap)
  group.add(lever)
  const indicator = new Mesh(new TorusGeometry(r * 0.44, r * 0.035, 8, 20), dark)
  indicator.rotation.x = Math.PI / 2
  indicator.position.y = r * 1.08
  group.add(indicator)
  return group
}
