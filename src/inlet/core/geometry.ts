import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three'
import type { PoolInletNode } from './schema'

/** Builds the pool-facing flange, nozzle, and rear PVC socket. */
export function buildInletGeometry(node: PoolInletNode): Group {
  const group = new Group()
  const white = new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.35 })
  const rim = new MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.28 })
  const socket = new MeshStandardMaterial({ color: '#475569', roughness: 0.55 })
  const axis = Math.PI / 2

  const flange = new Mesh(new CylinderGeometry(node.flangeRadius, node.flangeRadius, 0.035, 32), rim)
  flange.rotation.x = axis
  flange.position.z = 0.025
  group.add(flange)

  const body = new Mesh(new CylinderGeometry(node.nozzleDiameter * 1.45, node.nozzleDiameter * 1.45, node.bodyDepth, 20), white)
  body.rotation.x = axis
  body.position.z = -node.bodyDepth / 2
  group.add(body)

  const nozzle = new Mesh(new CylinderGeometry(node.nozzleDiameter / 2, node.nozzleDiameter / 2, 0.045, 20), socket)
  nozzle.rotation.x = axis
  nozzle.position.z = 0.065
  group.add(nozzle)

  const socketRing = new Mesh(new TorusGeometry(node.nozzleDiameter * 0.72, 0.012, 8, 20), socket)
  socketRing.rotation.x = axis
  socketRing.position.z = -node.bodyDepth - 0.015
  group.add(socketRing)

  const rearSocket = new Mesh(new CylinderGeometry(node.nozzleDiameter / 2, node.nozzleDiameter / 2, 0.035, 20), socket)
  rearSocket.rotation.x = axis
  rearSocket.position.z = -node.bodyDepth - 0.02
  group.add(rearSocket)
  return group
}
