import {
  CylinderGeometry,
  BoxGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'
import type { PoolPipeNode } from './schema'
import { derivePipeFittingKind, validatePipeNetwork } from '../../design/pipe-network'
import { planPipeFitting } from '../design/fitting-plan'

const PIPE_AXIS = new Vector3(0, 1, 0)
const direction = new Vector3()
const midpoint = new Vector3()
const orientation = new Quaternion()

function fittingHubGeometry(kind: 'elbow' | 'tee' | 'y' | 'cross', diameter: number) {
  const radius = diameter * 0.92
  if (kind === 'cross') return new BoxGeometry(radius * 1.9, radius * 1.9, radius * 1.9)
  if (kind === 'y') return new IcosahedronGeometry(radius, 1)
  return new SphereGeometry(radius, kind === 'elbow' ? 20 : 24, kind === 'elbow' ? 12 : 16)
}

function fittingMaterial(kind: 'elbow' | 'tee' | 'y' | 'cross') {
  const color = kind === 'cross' ? '#b8c4d2' : kind === 'y' ? '#c2ceda' : '#cbd5e1'
  return new MeshStandardMaterial({ color, roughness: kind === 'elbow' ? 0.24 : 0.28 })
}

export function buildPipeGeometry(network: PoolPipeNode): Group {
  const group = new Group()
  const nodes = new Map(network.nodes.map((node) => [node.id, node]))
  const pipeMaterial = new MeshStandardMaterial({ color: '#e5e7eb', roughness: 0.32 })
  // Fittings are intentionally a little darker and thicker than the pipe so
  // they remain visible at a bend instead of reading as two cylinders that
  // merely happen to touch.
  const jointMaterial = new MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.28 })
  const invalidNodeIds = new Set(validatePipeNetwork(network).flatMap((issue) => issue.nodeId ? [issue.nodeId] : []))

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
    mesh.userData = {
      pipeEdgeId: edge.id,
      pipeEdgeStart: [...start],
      pipeEdgeEnd: [...end],
    }
    group.add(mesh)
  }

  for (const node of network.nodes) {
    // Endpoints terminate on equipment sockets or are intentionally open;
    // rendering a sphere there overlaps the socket face and creates a visible
    // circular z-fighting artifact. Actual fittings still get a joint body.
    // Crossings between separate networks are represented by an explicit
    // cross node. Its local graph has only two edges, so deriving from this
    // network alone would incorrectly downgrade it to a straight run.
    const derivedKind = node.kind === 'cross' ? 'cross' : derivePipeFittingKind(network, node.id)
    const nodeIsExplicitFitting = node.kind === 'elbow' || node.kind === 'tee' || node.kind === 'y' || node.kind === 'cross'
    const kind = invalidNodeIds.has(node.id)
      && nodeIsExplicitFitting
      && (derivedKind === 'endpoint' || derivedKind === 'straight')
      ? node.kind
      : derivedKind
    if (kind !== 'elbow' && kind !== 'tee' && kind !== 'y' && kind !== 'cross') continue
    const fittingKind: 'elbow' | 'tee' | 'y' | 'cross' = kind
    const fittingEdges = network.edges.filter((edge) => edge.from === node.id || edge.to === node.id)
    const edgeDirections = fittingEdges.map((edge) => {
      const neighborId = edge.from === node.id ? edge.to : edge.from
      const neighbor = nodes.get(neighborId)
      return neighbor ? [neighbor.position[0] - node.position[0], neighbor.position[1] - node.position[1], neighbor.position[2] - node.position[2]] as [number, number, number] : null
    }).filter((value): value is [number, number, number] => value !== null && Math.hypot(...value) > Number.EPSILON)
    const derivedFittingKind: 'elbow' | 'tee' | 'y' | 'cross' | null = derivedKind === 'elbow' || derivedKind === 'tee' || derivedKind === 'y' || derivedKind === 'cross'
      ? derivedKind
      : null
    const derivedFitting = derivedFittingKind
      ? planPipeFitting(derivedFittingKind, [...node.position], edgeDirections, network.diameter)
      : null
    const fitting = planPipeFitting(fittingKind, [...node.position], edgeDirections, network.diameter)
      ?? derivedFitting
      ?? (invalidNodeIds.has(node.id) && edgeDirections.length >= 2
        ? planPipeFitting('elbow', [...node.position], edgeDirections.slice(0, 2), network.diameter)
        : null)
    if (!fitting) continue
    const invalid = invalidNodeIds.has(node.id)
    const hub = new Mesh(fittingHubGeometry(fittingKind, network.diameter), invalid
      ? new MeshStandardMaterial({ color: '#ef4444', roughness: 0.3 })
      : fittingMaterial(fittingKind))
    hub.position.set(...node.position)
    hub.userData = { pipeNodeId: node.id, pipeFittingKind: fittingKind, pipeFittingBody: true, pipeFittingInvalid: invalid }
    group.add(hub)

    for (const direction of fitting.portDirections) {
      const length = fitting.collarLength
      const armDirection = new Vector3(...direction)
      armDirection.normalize()
      const arm = new Mesh(
        new CylinderGeometry(network.diameter * 0.7, network.diameter * 0.7, length, 16),
        jointMaterial,
      )
      arm.position.copy(hub.position).addScaledVector(armDirection, length * 0.5)
      arm.quaternion.copy(orientation.setFromUnitVectors(PIPE_AXIS, armDirection))
      arm.userData = { pipeNodeId: node.id, pipeFittingKind: kind }
      group.add(arm)
    }
  }

  return group
}
