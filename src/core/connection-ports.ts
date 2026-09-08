import { useScene, type NodePort } from '@pascal-app/core'

export const METERS_PER_INCH = 0.0254

export type LocalConnectionPort = Omit<NodePort, 'position' | 'direction' | 'diameter'> & {
  position: readonly [number, number, number]
  direction: readonly [number, number, number]
  diameterM: number
}

type TransformNode = {
  parentId?: string | null
  position: readonly [number, number, number]
  rotation: readonly [number, number, number]
}

/** Rotate a vector using the same intrinsic XYZ Euler convention as Three.js. */
export function rotateVectorXYZ(
  vector: readonly [number, number, number],
  rotation: readonly [number, number, number],
): [number, number, number] {
  const [x, y, z] = vector
  const [rx, ry, rz] = rotation
  const a = Math.cos(rx)
  const b = Math.sin(rx)
  const c = Math.cos(ry)
  const d = Math.sin(ry)
  const e = Math.cos(rz)
  const f = Math.sin(rz)

  return [
    c * e * x - c * f * y + d * z,
    (a * f + b * e * d) * x + (a * e - b * f * d) * y - b * c * z,
    (b * f - a * e * d) * x + (b * e + a * f * d) * y + a * c * z,
  ]
}

/** Convert model-local metric sockets to Pascal's level-local, inch-sized port contract. */
export function connectionPorts(
  node: TransformNode,
  localPorts: readonly LocalConnectionPort[],
): NodePort[] {
  let ports: NodePort[] = localPorts.map(({ position, direction, diameterM, ...port }) => {
    const rotatedPosition = rotateVectorXYZ(position, node.rotation)
    return {
      ...port,
      position: [
        rotatedPosition[0] + node.position[0],
        rotatedPosition[1] + node.position[1],
        rotatedPosition[2] + node.position[2],
      ],
      direction: rotateVectorXYZ(direction, node.rotation),
      diameter: diameterM / METERS_PER_INCH,
      shape: 'round',
    }
  })
  // The editor consumes level-local ports even when the item renders as a pool child.
  const parent = node.parentId ? useScene.getState().nodes[node.parentId as never] : undefined
  if (parent && String(parent.type) === 'pool:pool') {
    const transform = parent as unknown as TransformNode
    ports = ports.map((port) => {
      const point = rotateVectorXYZ(port.position, transform.rotation)
      return { ...port, position: point.map((value, index) => value + transform.position[index]!) as [number, number, number], direction: rotateVectorXYZ(port.direction, transform.rotation) }
    })
  }
  return ports
}
