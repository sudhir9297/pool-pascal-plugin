import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import type { PoolPipeNode } from './schema'

const PIPE_AXIS = new Vector3(0, 1, 0)
const direction = new Vector3()
const midpoint = new Vector3()
const orientation = new Quaternion()

export function buildPipeGeometry(network: PoolPipeNode): Group {
  const group = new Group()
  const nodes = new Map(network.nodes.map((node) => [node.id, node]))
  const pipeMaterial = new MeshStandardMaterial({ color: '#e5e7eb', roughness: 0.32 })
  const jointMaterial = new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.28 })

  for (const edge of network.edges) {
    if (edge.style !== 'rigid') continue
    const start = nodes.get(edge.from)?.position
    const end = nodes.get(edge.to)?.position
    if (!start || !end) continue

    const startPoint = new Vector3(...start)
    const endPoint = new Vector3(...end)
    direction.subVectors(endPoint, startPoint)
    const length = direction.length()
    if (length <= Number.EPSILON) continue

    midpoint.addVectors(startPoint, endPoint).multiplyScalar(0.5)
    orientation.setFromUnitVectors(PIPE_AXIS, direction.normalize())
    const mesh = new Mesh(
      new CylinderGeometry(network.diameter / 2, network.diameter / 2, length, 16),
      pipeMaterial,
    )
    mesh.position.copy(midpoint)
    mesh.quaternion.copy(orientation)
    mesh.userData = { pipeEdgeId: edge.id }
    group.add(mesh)
  }

  const jointGeometry = new SphereGeometry(network.diameter * 0.62, 16, 8)
  for (const node of network.nodes) {
    const mesh = new Mesh(jointGeometry, jointMaterial)
    mesh.position.set(...node.position)
    mesh.userData = { pipeNodeId: node.id }
    group.add(mesh)
  }

  return group
}
