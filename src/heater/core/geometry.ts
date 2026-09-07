import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Euler,
  Group,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import type { PoolHeaterNode } from './schema'

const UP = new Vector3(0, 1, 0)

type HeaterPortRole = 'inlet' | 'outlet'
export type HeaterPort = {
  role: HeaterPortRole
  label: string
  position: Vector3
  direction: Vector3
}

/** Port order is stable: cold-water inlet first, heated-water outlet second. */
export function getHeaterPortsLocal(
  node: Pick<PoolHeaterNode, 'bodyWidth' | 'bodyHeight' | 'bodyDepth' | 'portDiameter'>,
): HeaterPort[] {
  const x = node.bodyWidth / 2 + node.portDiameter * 2.4
  return [
    {
      role: 'inlet',
      label: 'Cold-water inlet',
      position: new Vector3(x, node.bodyHeight * 0.29, node.bodyDepth * 0.17),
      direction: new Vector3(1, 0, 0),
    },
    {
      role: 'outlet',
      label: 'Heated-water outlet',
      position: new Vector3(x, node.bodyHeight * 0.17, node.bodyDepth * 0.17),
      direction: new Vector3(1, 0, 0),
    },
  ]
}

export function getHeaterPortPositions(node: PoolHeaterNode): Vector3[] {
  const rotation = new Euler(node.rotation[0], node.rotation[1], node.rotation[2], 'XYZ')
  const translation = new Vector3(node.position[0], node.position[1], node.position[2])
  return getHeaterPortsLocal(node).map(({ position }) => position.clone().applyEuler(rotation).add(translation))
}

function identify<T extends Mesh>(mesh: T, name: string, role = 'body'): T {
  mesh.name = name
  mesh.userData = { heaterPart: name, role }
  return mesh
}

function addBox(
  group: Group,
  name: string,
  size: Vector3,
  position: Vector3,
  material: MeshStandardMaterial,
) {
  const result = identify(new Mesh(new BoxGeometry(size.x, size.y, size.z), material), name)
  result.position.copy(position)
  group.add(result)
  return result
}

function addCylinderBetween(
  group: Group,
  name: string,
  start: Vector3,
  end: Vector3,
  radius: number,
  material: MeshStandardMaterial,
  segments = 24,
) {
  const direction = new Vector3().subVectors(end, start)
  const result = identify(new Mesh(new CylinderGeometry(radius, radius, direction.length(), segments), material), name)
  result.position.copy(start).add(end).multiplyScalar(0.5)
  result.quaternion.setFromUnitVectors(UP, direction.clone().normalize())
  group.add(result)
  return result
}

function addFrontFan(
  group: Group,
  name: string,
  center: Vector3,
  radius: number,
  dark: MeshStandardMaterial,
  blade: MeshStandardMaterial,
) {
  const shroud = identify(new Mesh(new CircleGeometry(radius, 40), dark), `${name}-shroud`)
  shroud.position.copy(center)
  group.add(shroud)

  const hub = identify(new Mesh(new CylinderGeometry(radius * 0.13, radius * 0.13, 0.025, 20), blade), `${name}-hub`)
  hub.position.copy(center).add(new Vector3(0, 0, 0.012))
  hub.rotation.x = Math.PI / 2
  group.add(hub)

  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2
    const fanBlade = addBox(
      group,
      `${name}-blade-${index + 1}`,
      new Vector3(radius * 0.7, radius * 0.18, 0.018),
      center.clone().add(new Vector3(Math.cos(angle) * radius * 0.38, Math.sin(angle) * radius * 0.38, 0.018)),
      blade,
    )
    fanBlade.rotation.z = angle + 0.3
  }
}

function addFrontCoilBay(
  group: Group,
  name: string,
  centerX: number,
  centerY: number,
  bayWidth: number,
  bayHeight: number,
  frontZ: number,
  white: MeshStandardMaterial,
  coil: MeshStandardMaterial,
  dark: MeshStandardMaterial,
  fanBlade: MeshStandardMaterial,
) {
  const frameWidth = Math.max(0.025, bayWidth * 0.055)
  const innerWidth = bayWidth - frameWidth * 2
  const innerHeight = bayHeight - frameWidth * 2

  addBox(group, `${name}-coil`, new Vector3(innerWidth, innerHeight, 0.018), new Vector3(centerX, centerY, frontZ), coil)
  addFrontFan(group, `${name}-fan`, new Vector3(centerX, centerY, frontZ + 0.012), Math.min(innerWidth, innerHeight) * 0.39, dark, fanBlade)

  addBox(group, `${name}-frame-left`, new Vector3(frameWidth, bayHeight, 0.05), new Vector3(centerX - bayWidth / 2 + frameWidth / 2, centerY, frontZ + 0.026), white)
  addBox(group, `${name}-frame-right`, new Vector3(frameWidth, bayHeight, 0.05), new Vector3(centerX + bayWidth / 2 - frameWidth / 2, centerY, frontZ + 0.026), white)
  addBox(group, `${name}-frame-top`, new Vector3(bayWidth, frameWidth, 0.05), new Vector3(centerX, centerY + bayHeight / 2 - frameWidth / 2, frontZ + 0.026), white)
  addBox(group, `${name}-frame-bottom`, new Vector3(bayWidth, frameWidth, 0.05), new Vector3(centerX, centerY - bayHeight / 2 + frameWidth / 2, frontZ + 0.026), white)

  const columns = 10
  const rows = 10
  for (let index = 1; index < columns; index += 1) {
    addBox(
      group,
      `${name}-grille-column-${index}`,
      new Vector3(Math.max(0.008, bayWidth * 0.015), innerHeight, 0.026),
      new Vector3(centerX - innerWidth / 2 + (innerWidth * index) / columns, centerY, frontZ + 0.052),
      white,
    )
  }
  for (let index = 1; index < rows; index += 1) {
    addBox(
      group,
      `${name}-grille-row-${index}`,
      new Vector3(innerWidth, Math.max(0.008, bayHeight * 0.014), 0.026),
      new Vector3(centerX, centerY - innerHeight / 2 + (innerHeight * index) / rows, frontZ + 0.052),
      white,
    )
  }
}

function addSideCoilGrille(
  group: Group,
  width: number,
  height: number,
  depth: number,
  white: MeshStandardMaterial,
  coil: MeshStandardMaterial,
) {
  const sideX = width / 2 + 0.012
  const grilleHeight = height * 0.52
  const grilleDepth = depth * 0.7
  const centerY = height * 0.13
  const centerZ = -depth * 0.02

  addBox(group, 'heater-side-coil', new Vector3(0.018, grilleHeight, grilleDepth), new Vector3(sideX, centerY, centerZ), coil)
  for (let index = 1; index < 9; index += 1) {
    addBox(
      group,
      `heater-side-grille-column-${index}`,
      new Vector3(0.034, grilleHeight, 0.012),
      new Vector3(sideX + 0.018, centerY, centerZ - grilleDepth / 2 + (grilleDepth * index) / 9),
      white,
    )
  }
  for (let index = 1; index < 10; index += 1) {
    addBox(
      group,
      `heater-side-grille-row-${index}`,
      new Vector3(0.034, 0.012, grilleDepth),
      new Vector3(sideX + 0.018, centerY - grilleHeight / 2 + (grilleHeight * index) / 10, centerZ),
      white,
    )
  }
}

function addTopFan(
  group: Group,
  name: string,
  centerX: number,
  height: number,
  mountY: number,
  radius: number,
  white: MeshStandardMaterial,
  dark: MeshStandardMaterial,
) {
  const layerGap = 0.002
  const housingHeight = height * 0.045
  const housingBottom = mountY + layerGap
  const housingTop = housingBottom + housingHeight
  const housing = identify(new Mesh(new CylinderGeometry(radius, radius * 1.06, housingHeight, 32), white), `${name}-housing`)
  housing.position.set(centerX, housingBottom + housingHeight / 2, 0)
  group.add(housing)

  const ring = identify(new Mesh(new RingGeometry(radius * 0.45, radius * 0.84, 32), dark), `${name}-ring`)
  ring.position.set(centerX, housingTop + layerGap, 0)
  ring.rotation.x = -Math.PI / 2
  group.add(ring)

  const bladeThickness = height * 0.012
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2
    const blade = addBox(
      group,
      `${name}-blade-${index + 1}`,
      new Vector3(radius * 0.72, bladeThickness, radius * 0.18),
      new Vector3(centerX + Math.cos(angle) * radius * 0.32, housingTop + layerGap + bladeThickness / 2, Math.sin(angle) * radius * 0.32),
      dark,
    )
    blade.rotation.y = -angle + 0.35
  }
}

/** Builds a detailed twin-fan pool heat pump based on a commercial outdoor unit. */
export function buildHeaterGeometry(node: PoolHeaterNode): Group {
  const group = new Group()
  group.name = 'pool-heater-geometry'
  group.position.y = node.bodyHeight / 2
  group.userData = { heaterPart: 'pool-heater', portOrder: ['inlet', 'outlet'] }

  const white = new MeshStandardMaterial({ color: '#e8edef', roughness: 0.55, metalness: 0.12 })
  const trim = new MeshStandardMaterial({ color: '#b8c0c5', roughness: 0.62, metalness: 0.18 })
  const coil = new MeshStandardMaterial({ color: node.technology === 'heat-pump' ? '#176ca8' : '#526575', roughness: 0.36, metalness: 0.28 })
  const coilDark = new MeshStandardMaterial({ color: '#102b3b', roughness: 0.55, metalness: 0.12 })
  const fanBlade = new MeshStandardMaterial({ color: '#324653', roughness: 0.62, metalness: 0.2 })
  const base = new MeshStandardMaterial({ color: '#202b31', roughness: 0.7, metalness: 0.15 })
  const pvc = new MeshStandardMaterial({ color: '#eef2f3', roughness: 0.42, metalness: 0.04 })
  const inletMaterial = new MeshStandardMaterial({ color: '#38bdf8', roughness: 0.32 })
  const outletMaterial = new MeshStandardMaterial({ color: '#f97316', roughness: 0.32 })
  const width = node.bodyWidth
  const height = node.bodyHeight
  const depth = node.bodyDepth
  const bottom = -height / 2
  const top = height / 2
  const frontZ = depth / 2 + 0.012

  addBox(group, 'heater-cabinet', new Vector3(width, height, depth), new Vector3(), white)
  addBox(group, 'heater-dark-plinth', new Vector3(width * 1.035, height * 0.055, depth * 1.035), new Vector3(0, bottom + height * 0.0275, 0), base)
  const topLayerGap = 0.002
  const topCapHeight = height * 0.035
  const topCapBottom = top + topLayerGap
  const topCapTop = topCapBottom + topCapHeight
  addBox(group, 'heater-top-cap', new Vector3(width * 1.015, topCapHeight, depth * 1.015), new Vector3(0, topCapBottom + topCapHeight / 2, 0), trim)

  const upperBottom = bottom + height * 0.37
  const upperTop = top - height * 0.075
  const bayHeight = upperTop - upperBottom
  const bayCenterY = (upperBottom + upperTop) / 2
  const sideMargin = width * 0.045
  const centerGap = width * 0.035
  const bayWidth = (width - sideMargin * 2 - centerGap) / 2
  const bayOffset = centerGap / 2 + bayWidth / 2

  addFrontCoilBay(group, 'heater-left-bay', -bayOffset, bayCenterY, bayWidth, bayHeight, frontZ, white, coil, coilDark, fanBlade)
  addFrontCoilBay(group, 'heater-right-bay', bayOffset, bayCenterY, bayWidth, bayHeight, frontZ, white, coil, coilDark, fanBlade)
  addBox(group, 'heater-center-stile', new Vector3(centerGap, bayHeight + height * 0.035, 0.065), new Vector3(0, bayCenterY, frontZ + 0.035), trim)

  const lowerPanelHeight = height * 0.3
  const lowerPanelY = bottom + height * 0.055 + lowerPanelHeight / 2
  for (const [index, centerX] of [-bayOffset, bayOffset].entries()) {
    addBox(group, `heater-service-door-${index + 1}`, new Vector3(bayWidth, lowerPanelHeight, 0.024), new Vector3(centerX, lowerPanelY, frontZ + 0.014), white)
    addBox(group, `heater-service-door-seam-${index + 1}`, new Vector3(bayWidth * 0.94, 0.009, 0.032), new Vector3(centerX, lowerPanelY + lowerPanelHeight / 2, frontZ + 0.026), trim)
    const latch = identify(new Mesh(new CylinderGeometry(0.012, 0.012, 0.012, 16), base), `heater-service-latch-${index + 1}`)
    latch.position.set(centerX + bayWidth * 0.34, lowerPanelY, frontZ + 0.04)
    latch.rotation.x = Math.PI / 2
    group.add(latch)
  }

  addBox(group, 'heater-corner-rail-left', new Vector3(width * 0.025, height * 0.92, 0.055), new Vector3(-width * 0.487, 0, frontZ + 0.03), trim)
  addBox(group, 'heater-corner-rail-right', new Vector3(width * 0.025, height * 0.92, 0.055), new Vector3(width * 0.487, 0, frontZ + 0.03), trim)
  addBox(group, 'heater-control-display', new Vector3(bayWidth * 0.35, height * 0.055, 0.028), new Vector3(bayOffset, lowerPanelY + height * 0.035, frontZ + 0.036), trim)
  addBox(group, 'heater-control-screen', new Vector3(bayWidth * 0.2, height * 0.027, 0.012), new Vector3(bayOffset, lowerPanelY + height * 0.035, frontZ + 0.057), coilDark)

  addSideCoilGrille(group, width, height, depth, white, coilDark)

  if (node.technology === 'heat-pump') {
    addTopFan(group, 'heater-left-top-fan', -bayOffset, height, topCapTop, bayWidth * 0.31, white, base)
    addTopFan(group, 'heater-right-top-fan', bayOffset, height, topCapTop, bayWidth * 0.31, white, base)
  }

  if (node.showExhaust && node.technology === 'gas') {
    const exhaustHeight = height * 0.2
    const exhaustBottom = topCapTop + topLayerGap
    const exhaust = identify(new Mesh(new CylinderGeometry(node.exhaustDiameter / 2, node.exhaustDiameter * 0.57, exhaustHeight, 28), base), 'heater-exhaust')
    exhaust.position.set(0, exhaustBottom + exhaustHeight / 2, 0)
    group.add(exhaust)
    const rim = identify(new Mesh(new TorusGeometry(node.exhaustDiameter * 0.53, node.exhaustDiameter * 0.055, 10, 28), base), 'heater-exhaust-rim')
    rim.position.set(0, exhaustBottom + exhaustHeight + topLayerGap, 0)
    rim.rotation.x = Math.PI / 2
    group.add(rim)
  }

  for (const port of getHeaterPortsLocal(node)) {
    const localPort = port.position.clone().setY(port.position.y - height / 2)
    const cabinetSide = new Vector3(width / 2 + 0.005, localPort.y, localPort.z)
    addCylinderBetween(group, `heater-${port.role}-pipe`, cabinetSide, localPort, node.portDiameter * 0.52, pvc)

    const unionCenter = localPort.clone().addScaledVector(port.direction, -node.portDiameter * 0.48)
    const union = identify(new Mesh(new CylinderGeometry(node.portDiameter * 0.76, node.portDiameter * 0.76, node.portDiameter * 0.48, 24), pvc), `heater-${port.role}-union`)
    union.position.copy(unionCenter)
    union.quaternion.setFromUnitVectors(UP, port.direction)
    group.add(union)

    const faceMaterial = port.role === 'inlet' ? inletMaterial : outletMaterial
    const face = identify(new Mesh(new CylinderGeometry(node.portDiameter / 2, node.portDiameter / 2, 0.012, 24), faceMaterial), `heater-port-${port.role}-face`, 'port-face')
    face.position.copy(localPort)
    face.quaternion.setFromUnitVectors(UP, port.direction)
    face.userData = { heaterPart: face.name, role: 'port-face', portRole: port.role }
    group.add(face)
  }

  return group
}
