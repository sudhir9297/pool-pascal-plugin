import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TorusGeometry } from 'three'
import type { PoolSkimmerNode } from './schema'

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

  // Only the user-facing trim is modeled. The concealed housing, basket and
  // suction plumbing belong inside the wall and are intentionally omitted.
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

  // Small exposed socket: the hidden plumbing starts behind this fitting.
  // Its center is also the pipe tool's magnetic snap point.
  const socketRing = new Mesh(new TorusGeometry(node.suctionDiameter * 0.72, 0.012, 8, 16), socket)
  socketRing.position.set(0, waterY - 0.31, -0.14)
  group.add(socketRing)
  const socketOpening = new Mesh(new CylinderGeometry(node.suctionDiameter / 2, node.suctionDiameter / 2, 0.018, 16), socket)
  socketOpening.rotation.x = Math.PI / 2
  socketOpening.position.set(0, waterY - 0.31, -0.145)
  group.add(socketOpening)

  return group
}
