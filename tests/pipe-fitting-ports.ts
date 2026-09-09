import type { NodePort, PipeFittingNode } from '@pascal-app/core'
import { Euler, Vector3 } from 'three'

export function nativeFittingPorts(node: PipeFittingNode): NodePort[] {
  const leg = Math.max(0.07, node.diameter * 0.0254 * 1.1)
  const directions = node.fittingType === 'elbow' ? [[-1, 0, 0], [0, 0, 1]] : [[-1, 0, 0], [1, 0, 0], [0, 0, 1]]
  return directions.map((direction, i) => {
    const d = new Vector3(...direction).applyEuler(new Euler(...node.rotation))
    return { id: ['inlet', 'outlet', 'branch'][i]!, position: d.clone().multiplyScalar(leg).add(new Vector3(...node.position)).toArray(), direction: d.toArray(), diameter: node.diameter, system: node.system }
  })
}

