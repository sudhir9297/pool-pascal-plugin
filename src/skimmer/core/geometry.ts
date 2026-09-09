import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three'
import type { PoolSkimmerNode } from './schema'
import { getSkimmerPortsLocal } from './ports'

/**
 * Builds a recognizable cutaway skimmer. Local +Z is the pool-facing mouth;
 * the housing and suction port project toward -Z, outside the pool wall.
 */
export function buildSkimmerGeometry(node: PoolSkimmerNode): Group {
  const group = new Group()
  const white = new MeshStandardMaterial({ color: '#f5f5f4', roughness: 0.42 })
  const rim = new MeshStandardMaterial({ color: '#d6d3d1', roughness: 0.3 })
  const socket = new MeshStandardMaterial({ color: '#475569', roughness: 0.55 })
  const water = new MeshStandardMaterial({ color: '#67e8f9', transparent: true, opacity: 0.25 })
  const { bodyWidth: w, mouthHeight: mh } = node
  const mw = node.style === 'wide-mouth' ? node.mouthWidth * 1.18 : node.mouthWidth
  const wall = 0.055
  const waterY = node.waterlineOffset

  const addBox = (width: number, height: number, depth: number, x: number, y: number, z: number, material: MeshStandardMaterial) => {
    const mesh = new Mesh(new BoxGeometry(width, height, depth), material)
    mesh.position.set(x, y, z)
    group.add(mesh)
    return mesh
  }

  addBox((w - mw) / 2, mh + wall * 2, wall, -(w + mw) / 4, waterY, wall / 2, rim)
  addBox((w - mw) / 2, mh + wall * 2, wall, (w + mw) / 4, waterY, wall / 2, rim)
  addBox(mw, wall, wall, 0, waterY + mh / 2 + wall / 2, wall / 2, rim)
  addBox(mw, wall, wall, 0, waterY - mh / 2 - wall / 2, wall / 2, rim)

  // Floating weir: hinged flap projecting into the pool and slightly below level.
  const weir = addBox(mw * 0.92, mh * 0.92, wall * 0.8, 0, waterY - mh * 0.14, wall * 1.05, white)
  weir.rotation.x = -0.12
  // Water surface marker makes the intended installation height legible in the model.
  addBox(mw * 0.94, 0.008, 0.025, 0, waterY, wall * 1.2, water)

  if (node.accessState === 'open') {
    const basketWidth = mw * 0.68
    const basketHeight = 0.08
    const basketMaterial = new MeshStandardMaterial({ color: '#475569', roughness: 0.6 })
    addBox(basketWidth, basketHeight, 0.012, 0, waterY - mh - 0.06, 0.03, basketMaterial)
    for (let index = -2; index <= 2; index += 1) addBox(0.008, basketHeight * 0.8, 0.018, index * basketWidth * 0.18, waterY - mh - 0.06, 0.045, basketMaterial)
  }

  const port = getSkimmerPortsLocal(node)[0]!
  const lipThickness = Math.min(0.008, node.suctionDiameter * 0.16)
  const outletRadius = node.suctionDiameter / 2 + lipThickness * 2
  const collarHeight = 0.06
  const neckBottom = port.position[1] + collarHeight * 0.75
  const neckTop = Math.max(waterY - mh / 2 - wall / 2, neckBottom + wall)
  const collectorRadius = Math.max(outletRadius, Math.min(mw * 0.32, node.bodyDepth * 0.38))
  const throat = addBox(collectorRadius * 2, wall, node.bodyDepth / 2, 0, neckTop, -node.bodyDepth / 4, white)
  throat.name = 'suction-throat'
  const neck = new Mesh(new CylinderGeometry(collectorRadius, outletRadius, neckTop - neckBottom, 24, 1, true), white)
  neck.name = 'suction-outlet-neck'
  neck.position.set(port.position[0], (neckTop + neckBottom) / 2, port.position[2])
  group.add(neck)

  // Keep all collar geometry above the connection plane so the pipe meets a free face.
  const socketRing = new Mesh(new TorusGeometry(node.suctionDiameter / 2 + lipThickness, lipThickness, 8, 24), socket)
  socketRing.name = 'suction-socket-ring'
  socketRing.rotation.x = Math.PI / 2
  socketRing.position.set(port.position[0], port.position[1] + lipThickness, port.position[2])
  group.add(socketRing)
  const socketOpening = new Mesh(new CylinderGeometry(outletRadius, outletRadius, collarHeight, 24, 1, true), socket)
  socketOpening.name = 'suction-socket-opening'
  socketOpening.position.set(port.position[0], port.position[1] + collarHeight / 2, port.position[2])
  group.add(socketOpening)

  return group
}
