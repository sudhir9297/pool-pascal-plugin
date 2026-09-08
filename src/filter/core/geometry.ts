import {
  BoxGeometry,
  CylinderGeometry,
  Euler,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three'
import type { PoolFilterNode } from './schema'
import {
  FILTER_FLOOR_CLEARANCE,
  getFilterConnectionPortsLocal,
  type FilterPortRole,
} from './ports'

const Y_AXIS = new Vector3(0, 1, 0)

export { FILTER_FLOOR_CLEARANCE, type FilterPortRole } from './ports'

export type FilterPort = {
  role: FilterPortRole
  label: string
  position: Vector3
  direction: Vector3
}

type FilterGeometryNode = Pick<
  PoolFilterNode,
  'diameter' | 'bodyHeight' | 'portDiameter' | 'technology' | 'showGauge'
>

type FilterLayout = {
  radius: number
  pedestalHeight: number
  tankBottom: number
  tankTop: number
  valveCenterY: number
  valveRadius: number
}

function getFilterLayout(node: FilterGeometryNode): FilterLayout {
  const radius = node.diameter / 2
  const pedestalHeight = Math.max(0.11, radius * 0.34)
  const tankBottom = FILTER_FLOOR_CLEARANCE + pedestalHeight * 0.72
  const tankTop = tankBottom + node.bodyHeight
  const valveRadius = Math.max(radius * 0.39, node.portDiameter * 2.25)
  const valveCenterY = tankTop + Math.max(0.095, radius * 0.27)
  return { radius, pedestalHeight, tankBottom, tankTop, valveCenterY, valveRadius }
}

function tankRadiusAt(radius: number, progress: number) {
  if (progress < 0.08) return radius * (0.48 + progress * 4.4)
  if (progress < 0.2) return radius * (0.832 + (progress - 0.08) * 1.4)
  if (progress < 0.72) return radius
  if (progress < 0.82) return radius * (1 - (progress - 0.72) * 0.4)
  if (progress < 0.93) return radius * (0.96 - (progress - 0.82) * 2.55)
  return radius * (0.6795 - (progress - 0.93) * 2.85)
}

function addCylinder(
  group: Group,
  start: Vector3,
  end: Vector3,
  radius: number,
  material: MeshStandardMaterial,
  name?: string,
) {
  const direction = new Vector3().subVectors(end, start)
  const mesh = new Mesh(new CylinderGeometry(radius, radius, direction.length(), 24), material)
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.clone().normalize())
  if (name) mesh.name = name
  group.add(mesh)
  return mesh
}

function addHorizontalRing(group: Group, radius: number, y: number, tube: number, material: MeshStandardMaterial, name?: string) {
  const ring = new Mesh(new TorusGeometry(radius, tube, 5, 64), material)
  ring.rotation.x = Math.PI / 2
  ring.position.y = y
  if (name) ring.name = name
  group.add(ring)
}

/**
 * Connection endpoints in model-local coordinates.
 *
 * The point is the centre of the outer socket face, not the centre of its
 * mesh. The same values drive the visible socket and connection port.
 */
export function getFilterPortsLocal(node: FilterGeometryNode): FilterPort[] {
  return getFilterConnectionPortsLocal(node).map((port) => ({
    role: port.id,
    label: port.label,
    position: new Vector3(...port.position),
    direction: new Vector3(...port.direction),
  }))
}

export function getFilterPortPositions(node: PoolFilterNode): Vector3[] {
  const rotation = new Euler(node.rotation[0], node.rotation[1], node.rotation[2])
  const origin = new Vector3(...node.position)
  return getFilterPortsLocal(node).map((port) => port.position.clone().applyEuler(rotation).add(origin))
}

function addTank(group: Group, node: FilterGeometryNode, shellMaterial: MeshStandardMaterial, ribMaterial: MeshStandardMaterial) {
  const { radius, tankBottom, tankTop } = getFilterLayout(node)
  const profile = [
    new Vector2(radius * 0.38, tankBottom),
    new Vector2(radius * 0.62, tankBottom + node.bodyHeight * 0.035),
    new Vector2(radius * 0.86, tankBottom + node.bodyHeight * 0.105),
    new Vector2(radius * 0.97, tankBottom + node.bodyHeight * 0.19),
    new Vector2(radius, tankBottom + node.bodyHeight * 0.27),
    new Vector2(radius, tankBottom + node.bodyHeight * 0.72),
    new Vector2(radius * 0.96, tankBottom + node.bodyHeight * 0.82),
    new Vector2(radius * 0.84, tankBottom + node.bodyHeight * 0.9),
    new Vector2(radius * 0.68, tankBottom + node.bodyHeight * 0.95),
    new Vector2(radius * 0.48, tankTop),
  ]
  const shell = new Mesh(new LatheGeometry(profile, 64), shellMaterial)
  shell.name = 'filter-ribbed-tank'
  group.add(shell)

  const ribCount = Math.max(22, Math.round(node.bodyHeight / 0.018))
  const ribTube = Math.min(0.0045, radius * 0.011)
  for (let index = 1; index < ribCount; index += 1) {
    const progress = index / ribCount
    if (progress < 0.035 || progress > 0.965) continue
    const y = tankBottom + node.bodyHeight * progress
    addHorizontalRing(group, tankRadiusAt(radius, progress) + ribTube * 0.15, y, ribTube, ribMaterial)
  }
}

function addPedestal(group: Group, node: FilterGeometryNode, material: MeshStandardMaterial) {
  const { radius, pedestalHeight } = getFilterLayout(node)
  const baseY = FILTER_FLOOR_CLEARANCE + 0.002
  const profile = [
    new Vector2(0, baseY),
    new Vector2(radius * 1.13, baseY),
    new Vector2(radius * 1.18, baseY + pedestalHeight * 0.17),
    new Vector2(radius * 1.08, baseY + pedestalHeight * 0.38),
    new Vector2(radius * 0.75, baseY + pedestalHeight),
    new Vector2(0, baseY + pedestalHeight),
  ]
  const pedestal = new Mesh(new LatheGeometry(profile, 64), material)
  pedestal.name = 'filter-flared-pedestal'
  group.add(pedestal)
  addHorizontalRing(group, radius * 1.135, baseY + 0.012, Math.min(0.01, radius * 0.025), material)
}

type FilterMaterials = ReturnType<typeof createFilterMaterials>

function createFilterMaterials() {
  return {
    shell: new MeshStandardMaterial({ color: '#8793a6', roughness: 0.62, metalness: 0.05 }),
    ribs: new MeshStandardMaterial({ color: '#748195', roughness: 0.72, metalness: 0.03 }),
    black: new MeshStandardMaterial({ color: '#090f1c', roughness: 0.48, metalness: 0.1 }),
    white: new MeshStandardMaterial({ color: '#e7edf5', roughness: 0.32, metalness: 0.02 }),
    whiteAccent: new MeshStandardMaterial({ color: '#cbd7e8', roughness: 0.38, metalness: 0.03 }),
    gaugeFace: new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.25 }),
    opening: new MeshStandardMaterial({ color: '#152238', roughness: 0.55 }),
    badge: new MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }),
    badgeBlue: new MeshStandardMaterial({ color: '#1677b8', roughness: 0.42 }),
  }
}

function addGauge(group: Group, y: number, z: number, radius: number, materials: FilterMaterials) {
  const gauge = new Group()
  gauge.name = 'filter-pressure-gauge'
  gauge.position.set(0, y, z)

  const caseDepth = radius * 0.34
  const gaugeCase = new Mesh(new CylinderGeometry(radius, radius, caseDepth, 32), materials.black)
  gaugeCase.rotation.x = Math.PI / 2
  gaugeCase.position.z = -caseDepth / 2
  gauge.add(gaugeCase)

  const face = new Mesh(new CylinderGeometry(radius * 0.84, radius * 0.84, 0.008, 32), materials.gaugeFace)
  face.rotation.x = Math.PI / 2
  face.position.z = 0.003
  gauge.add(face)

  const rim = new Mesh(new TorusGeometry(radius * 0.89, radius * 0.075, 8, 32), materials.black)
  rim.position.z = 0.01
  gauge.add(rim)

  for (let index = 0; index < 9; index += 1) {
    const angle = Math.PI * (0.18 + index * 0.08)
    const tick = new Mesh(new BoxGeometry(radius * 0.055, radius * 0.19, 0.008), materials.black)
    tick.position.set(Math.cos(angle) * radius * 0.6, Math.sin(angle) * radius * 0.6, 0.016)
    tick.rotation.z = angle - Math.PI / 2
    gauge.add(tick)
  }

  const needle = new Mesh(new BoxGeometry(radius * 0.08, radius * 0.68, 0.012), materials.black)
  needle.position.set(radius * 0.12, radius * 0.08, 0.022)
  needle.rotation.z = -0.42
  gauge.add(needle)
  group.add(gauge)
}

function addValve(group: Group, node: FilterGeometryNode, materials: FilterMaterials) {
  const { radius, tankTop, valveCenterY, valveRadius } = getFilterLayout(node)
  const neckHeight = Math.max(0.055, radius * 0.16)
  const neck = new Mesh(new CylinderGeometry(radius * 0.42, radius * 0.47, neckHeight, 40), materials.whiteAccent)
  neck.name = 'filter-valve-neck'
  neck.position.y = tankTop + neckHeight / 2
  group.add(neck)

  addHorizontalRing(group, radius * 0.455, tankTop + neckHeight * 0.2, Math.max(0.009, radius * 0.025), materials.black, 'filter-valve-gasket')

  const valveHeight = Math.max(0.13, radius * 0.38)
  const body = new Mesh(new CylinderGeometry(valveRadius * 0.94, valveRadius, valveHeight, 40), materials.white)
  body.name = 'filter-multiport-valve'
  body.position.y = valveCenterY
  group.add(body)

  const lowerFlange = new Mesh(new CylinderGeometry(valveRadius * 1.08, valveRadius * 1.08, 0.035, 40), materials.whiteAccent)
  lowerFlange.position.y = valveCenterY - valveHeight * 0.48
  group.add(lowerFlange)

  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2
    const bolt = new Mesh(new SphereGeometry(Math.max(0.009, radius * 0.026), 10, 8), materials.black)
    bolt.position.set(
      Math.cos(angle) * valveRadius * 0.83,
      valveCenterY - valveHeight * 0.49,
      Math.sin(angle) * valveRadius * 0.83,
    )
    group.add(bolt)
  }

  const capY = valveCenterY + valveHeight * 0.63
  const cap = new Mesh(new CylinderGeometry(valveRadius * 1.02, valveRadius * 1.08, 0.075, 40), materials.whiteAccent)
  cap.name = 'filter-selector-cap'
  cap.position.y = capY
  group.add(cap)

  const selector = new Mesh(new CylinderGeometry(valveRadius * 0.22, valveRadius * 0.24, 0.055, 24), materials.black)
  selector.position.y = capY + 0.064
  group.add(selector)

  const handleY = capY + 0.1
  const handle = new Group()
  handle.name = 'filter-selector-handle'
  handle.position.set(valveRadius * 0.3, handleY, 0)
  handle.rotation.y = -0.22
  const arm = new Mesh(new BoxGeometry(valveRadius * 1.35, 0.035, Math.max(0.055, valveRadius * 0.28)), materials.black)
  arm.position.x = valveRadius * 0.28
  handle.add(arm)
  addCylinder(
    handle,
    new Vector3(valveRadius * 0.84, 0, -valveRadius * 0.2),
    new Vector3(valveRadius * 0.84, 0, valveRadius * 0.2),
    Math.max(0.025, valveRadius * 0.16),
    materials.black,
  )
  group.add(handle)

  if (node.showGauge) {
    const gaugeRadius = Math.max(0.05, radius * 0.15)
    const gaugeY = valveCenterY + valveHeight * 0.02
    const gaugeZ = valveRadius + gaugeRadius * 0.14
    const stemStart = new Vector3(0, gaugeY - gaugeRadius * 0.8, valveRadius * 0.72)
    const stemEnd = new Vector3(0, gaugeY - gaugeRadius * 0.32, gaugeZ - gaugeRadius * 0.2)
    addCylinder(group, stemStart, stemEnd, gaugeRadius * 0.12, materials.black)
    addGauge(group, gaugeY, gaugeZ, gaugeRadius, materials)
  }
}

function addPortAssembly(group: Group, port: FilterPort, node: FilterGeometryNode, materials: FilterMaterials) {
  const { radius, valveRadius } = getFilterLayout(node)
  const direction = port.direction.clone()
  const endpoint = port.position.clone()
  const pipeRadius = node.portDiameter * 0.62
  const unionRadius = node.portDiameter * 1.15
  const unionLength = node.portDiameter * 1.35
  const socketDepth = Math.max(0.025, node.portDiameter * 0.5)
  const isWaste = port.role === 'waste'
  const material = isWaste ? materials.black : materials.white
  const bodyOffset = isWaste ? radius * 0.58 : valveRadius * 0.68
  const endpointDistance = Math.abs(endpoint.dot(direction))
  const bodyStart = endpoint.clone().sub(direction.clone().multiplyScalar(Math.max(unionLength * 2.4, endpointDistance - bodyOffset)))
  const unionStart = endpoint.clone().sub(direction.clone().multiplyScalar(unionLength + socketDepth))
  const socketStart = endpoint.clone().sub(direction.clone().multiplyScalar(socketDepth))

  addCylinder(group, bodyStart, unionStart, pipeRadius * 1.3, material)
  addCylinder(group, unionStart, socketStart, unionRadius, material, `filter-${port.role}-union`)

  const connection = new Group()
  connection.name = `filter-port-${port.role}`
  connection.position.copy(endpoint)
  connection.userData = { role: port.role, label: port.label }
  const socket = new Mesh(new CylinderGeometry(pipeRadius, pipeRadius, socketDepth, 28), materials.opening)
  socket.name = `filter-port-${port.role}-face`
  socket.quaternion.setFromUnitVectors(Y_AXIS, direction)
  socket.position.copy(direction).multiplyScalar(-socketDepth / 2)
  connection.add(socket)

  const lip = new Mesh(new TorusGeometry(pipeRadius * 1.03, Math.max(0.003, pipeRadius * 0.08), 6, 28), material)
  lip.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), direction)
  lip.position.copy(direction).multiplyScalar(-0.001)
  connection.add(lip)
  group.add(connection)
}

function addBadge(group: Group, node: FilterGeometryNode, materials: FilterMaterials) {
  const { radius, tankBottom } = getFilterLayout(node)
  const y = tankBottom + node.bodyHeight * 0.49
  const badge = new Mesh(new BoxGeometry(radius * 0.55, node.bodyHeight * 0.15, 0.012), materials.badge)
  badge.name = 'filter-equipment-badge'
  badge.position.set(0, y, radius + 0.002)
  group.add(badge)

  const mark = new Mesh(new BoxGeometry(radius * 0.34, node.bodyHeight * 0.025, 0.006), materials.badgeBlue)
  mark.position.set(0, y + node.bodyHeight * 0.012, radius + 0.011)
  group.add(mark)
  const markTop = new Mesh(new BoxGeometry(radius * 0.18, node.bodyHeight * 0.018, 0.006), materials.badgeBlue)
  markTop.position.set(0, y + node.bodyHeight * 0.047, radius + 0.011)
  group.add(markTop)
}

/** Builds the compact top-mount sand-filter assembly used by the editor. */
export function buildFilterGeometry(node: PoolFilterNode): Group {
  const group = new Group()
  group.name = 'pool-filter-model'
  const materials = createFilterMaterials()

  addPedestal(group, node, materials.black)
  addTank(group, node, materials.shell, materials.ribs)
  addValve(group, node, materials)
  addBadge(group, node, materials)
  for (const port of getFilterPortsLocal(node)) addPortAssembly(group, port, node, materials)

  return group
}
