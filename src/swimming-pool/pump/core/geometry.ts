import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import type { PoolPumpNode } from './schema'

const Y_AXIS = new Vector3(0, 1, 0)
const Z_AXIS = new Vector3(0, 0, 1)

/** Stored pump positions follow the host's floor surface; this is the model's base lift. */
export const PUMP_BASE_LIFT = 0.27

export const PUMP_PORT_DIRECTIONS = [new Vector3(0, 0, 1), new Vector3(0, 1, 0)] as const

function identify<T extends Mesh>(mesh: T, name: string, role = 'body'): T {
  mesh.name = name
  mesh.userData = { pumpPart: name, role }
  return mesh
}

function addCylinder(
  group: Group,
  name: string,
  start: Vector3,
  end: Vector3,
  radius: number,
  material: MeshStandardMaterial,
  radiusAtStart = radius,
) {
  const direction = new Vector3().subVectors(end, start)
  const mesh = identify(
    new Mesh(new CylinderGeometry(radius, radiusAtStart, direction.length(), 24), material),
    name,
  )
  mesh.position.copy(start).add(end).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize())
  group.add(mesh)
  return mesh
}

function addBox(group: Group, name: string, size: Vector3, position: Vector3, material: MeshStandardMaterial) {
  const mesh = identify(new Mesh(new BoxGeometry(size.x, size.y, size.z), material), name)
  mesh.position.copy(position)
  group.add(mesh)
  return mesh
}

function addPortFace(
  group: Group,
  name: string,
  position: Vector3,
  direction: Vector3,
  radius: number,
  material: MeshStandardMaterial,
) {
  const face = identify(new Mesh(new CircleGeometry(radius, 24), material), name, 'port-face')
  face.position.copy(position)
  face.quaternion.setFromUnitVectors(Z_AXIS, direction)
  group.add(face)
  return face
}

export function getPumpPortLocalPositions(
  node: Pick<PoolPumpNode, 'bodyDepth' | 'bodyHeight' | 'diameter'>,
): Vector3[] {
  const inletY = -node.bodyHeight * 0.53 + node.bodyHeight * 1.05 * 0.63
  const inletZ = node.bodyDepth / 2 + Math.max(0.12, node.diameter * 2.6)
  const outletY = Math.max(node.bodyHeight * 0.72, node.bodyHeight * 0.52 + node.diameter * 0.9)

  // Port order is part of the public connection contract: inlet first, outlet second.
  return [
    new Vector3(0, inletY + PUMP_BASE_LIFT, inletZ),
    new Vector3(0, outletY + PUMP_BASE_LIFT, -node.bodyDepth * 0.025),
  ]
}

export function getPumpPortPositions(node: PoolPumpNode): Vector3[] {
  const rotation = new Euler(node.rotation[0], node.rotation[1], node.rotation[2], 'XYZ')
  const position = new Vector3(node.position[0], node.position[1], node.position[2])
  return getPumpPortLocalPositions(node).map((point) => point.clone().applyEuler(rotation).add(position))
}

/** Builds a compact pool pump with a front strainer, raised discharge, and rear motor. */
export function buildPumpGeometry(node: PoolPumpNode): Group {
  const group = new Group()
  group.name = 'pool-pump-geometry'
  group.position.y = PUMP_BASE_LIFT
  group.userData = { pumpPart: 'pool-pump', portOrder: ['inlet', 'outlet'] }

  const black = new MeshStandardMaterial({ color: '#111417', roughness: 0.72, metalness: 0.08 })
  const blackSoft = new MeshStandardMaterial({ color: '#20252a', roughness: 0.62, metalness: 0.06 })
  const blackEdge = new MeshStandardMaterial({ color: '#080a0c', roughness: 0.78 })
  const teal = new MeshStandardMaterial({ color: '#087e89', roughness: 0.48, metalness: 0.18 })
  const tealEdge = new MeshStandardMaterial({ color: '#075c64', roughness: 0.56, metalness: 0.2 })
  const inletMaterial = new MeshStandardMaterial({ color: '#38bdf8', roughness: 0.32, side: DoubleSide })
  const outletMaterial = new MeshStandardMaterial({ color: '#22c55e', roughness: 0.32, side: DoubleSide })

  const width = node.bodyWidth
  const height = node.bodyHeight
  const depth = node.bodyDepth
  const pipeRadius = node.diameter / 2
  const ports = getPumpPortLocalPositions(node).map((port) => port.clone().setY(port.y - PUMP_BASE_LIFT))

  // Long molded rails keep the full assembly above the host floor.
  const railY = -PUMP_BASE_LIFT + height * 0.08
  const railHeight = height * 0.14
  const railLength = depth * 1.08
  for (const [index, x] of [-width * 0.36, width * 0.36].entries()) {
    addBox(
      group,
      `mounting-rail-${index + 1}`,
      new Vector3(width * 0.12, railHeight, railLength),
      new Vector3(x, railY, -depth * 0.02),
      blackEdge,
    )
  }
  for (const [index, z] of [-depth * 0.38, depth * 0.3].entries()) {
    addBox(
      group,
      `mounting-cross-foot-${index + 1}`,
      new Vector3(width * 0.88, height * 0.08, depth * 0.11),
      new Vector3(0, -PUMP_BASE_LIFT + height * 0.055, z),
      black,
    )
  }

  // The vertical front pot is the dominant silhouette in the reference pump.
  const potRadius = width * 0.37
  const potHeight = height * 1.05
  const potBottom = -height * 0.53
  const potTop = potBottom + potHeight
  const potZ = depth * 0.3
  addCylinder(
    group,
    'strainer-housing',
    new Vector3(0, potBottom, potZ),
    new Vector3(0, potTop, potZ),
    potRadius * 0.95,
    blackSoft,
    potRadius,
  )
  addCylinder(
    group,
    'strainer-lower-band',
    new Vector3(0, potBottom + height * 0.015, potZ),
    new Vector3(0, potBottom + height * 0.1, potZ),
    potRadius,
    blackEdge,
  )

  // Broad lid, clamp band, and four projecting clamp ears.
  const lidRadius = potRadius * 1.12
  const lidY = potTop + height * 0.075
  addCylinder(
    group,
    'strainer-lid',
    new Vector3(0, potTop, potZ),
    new Vector3(0, lidY, potZ),
    lidRadius * 0.92,
    blackSoft,
    lidRadius,
  )
  const lidRing = identify(new Mesh(new TorusGeometry(lidRadius, height * 0.035, 10, 32), blackEdge), 'strainer-lid-clamp')
  lidRing.rotation.x = Math.PI / 2
  lidRing.position.set(0, lidY, potZ)
  group.add(lidRing)
  addCylinder(
    group,
    'strainer-lid-cap',
    new Vector3(0, lidY, potZ),
    new Vector3(0, lidY + height * 0.045, potZ),
    lidRadius * 0.78,
    black,
  )
  for (const [index, angle] of [0, Math.PI / 2, Math.PI, Math.PI * 1.5].entries()) {
    const lug = addBox(
      group,
      `lid-clamp-lug-${index + 1}`,
      new Vector3(width * 0.13, height * 0.06, depth * 0.07),
      new Vector3(Math.cos(angle) * lidRadius, lidY, potZ + Math.sin(angle) * lidRadius),
      blackEdge,
    )
    lug.rotation.y = -angle
  }

  // Front suction inlet. Its final disc is centered exactly on the first hotspot.
  const inletPort = ports[0]!
  const inletStart = new Vector3(0, inletPort.y, potZ + potRadius * 0.68)
  addCylinder(group, 'inlet-neck', inletStart, inletPort, pipeRadius * 1.5, black)
  addCylinder(
    group,
    'inlet-union',
    inletPort.clone().addScaledVector(PUMP_PORT_DIRECTIONS[0], -node.diameter * 1.8),
    inletPort,
    pipeRadius * 1.95,
    blackEdge,
  )
  addPortFace(group, 'pump-port-inlet-face', inletPort, PUMP_PORT_DIRECTIONS[0], pipeRadius, inletMaterial)

  // Rounded volute bridges the strainer pot into the motor shaft.
  const volute = identify(new Mesh(new SphereGeometry(1, 32, 20), blackSoft), 'volute-housing')
  volute.scale.set(width * 0.43, height * 0.51, depth * 0.28)
  volute.position.set(0, height * 0.02, -depth * 0.005)
  group.add(volute)
  addCylinder(
    group,
    'volute-motor-transition',
    new Vector3(0, height * 0.02, -depth * 0.09),
    new Vector3(0, height * 0.02, -depth * 0.2),
    width * 0.27,
    blackEdge,
    width * 0.34,
  )

  // Raised priming/discharge tower behind the strainer lid.
  const outletPort = ports[1]!
  const towerZ = outletPort.z
  const towerRadius = Math.max(pipeRadius * 1.65, width * 0.095)
  const towerStart = new Vector3(0, height * 0.18, towerZ)
  addCylinder(group, 'outlet-tower', towerStart, outletPort, towerRadius, black)
  addCylinder(
    group,
    'outlet-union',
    outletPort.clone().addScaledVector(PUMP_PORT_DIRECTIONS[1], -node.diameter * 1.8),
    outletPort,
    pipeRadius * 1.95,
    blackEdge,
  )
  addPortFace(group, 'pump-port-outlet-face', outletPort, PUMP_PORT_DIRECTIONS[1], pipeRadius, outletMaterial)

  // Teal motor shell with longitudinal cooling ribs.
  const motorRadius = Math.min(width * 0.29, height * 0.37)
  const motorY = -height * 0.03
  const motorFrontZ = -depth * 0.17
  const motorRearZ = -depth * 0.53
  addCylinder(
    group,
    'motor-shell',
    new Vector3(0, motorY, motorFrontZ),
    new Vector3(0, motorY, motorRearZ),
    motorRadius,
    teal,
  )
  const motorLength = motorFrontZ - motorRearZ
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2
    const rib = addBox(
      group,
      `motor-cooling-rib-${index + 1}`,
      new Vector3(width * 0.025, height * 0.035, motorLength * 0.94),
      new Vector3(
        Math.cos(angle) * motorRadius * 1.025,
        motorY + Math.sin(angle) * motorRadius * 1.025,
        (motorFrontZ + motorRearZ) / 2,
      ),
      tealEdge,
    )
    rib.rotation.z = angle - Math.PI / 2
  }
  addCylinder(
    group,
    'motor-front-band',
    new Vector3(0, motorY, motorFrontZ + depth * 0.025),
    new Vector3(0, motorY, motorFrontZ - depth * 0.025),
    motorRadius * 1.04,
    tealEdge,
  )
  addCylinder(
    group,
    'motor-rear-cap',
    new Vector3(0, motorY, motorRearZ),
    new Vector3(0, motorY, motorRearZ - depth * 0.1),
    motorRadius * 0.91,
    black,
    motorRadius,
  )
  addCylinder(
    group,
    'motor-rear-cap-band',
    new Vector3(0, motorY, motorRearZ - depth * 0.015),
    new Vector3(0, motorY, motorRearZ - depth * 0.055),
    motorRadius * 1.015,
    blackEdge,
  )

  // Rectangular electrical terminal box perched above the rear half of the motor.
  const terminalY = motorY + motorRadius + height * 0.09
  addBox(
    group,
    'motor-terminal-box',
    new Vector3(width * 0.39, height * 0.18, depth * 0.18),
    new Vector3(0, terminalY, -depth * 0.39),
    black,
  )
  addBox(
    group,
    'motor-terminal-box-lid',
    new Vector3(width * 0.43, height * 0.045, depth * 0.2),
    new Vector3(0, terminalY + height * 0.11, -depth * 0.39),
    blackEdge,
  )

  return group
}
