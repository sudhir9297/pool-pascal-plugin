import { expect, test } from 'bun:test'
import { Box3, Vector3 } from 'three'
import { getSkimmerPortsLocal } from './ports'
import { PoolSkimmerNode } from './schema'
import { buildSkimmerGeometry } from './geometry'
import { disposeObject3D } from '../../editor/dispose-object'
import { connectionPorts } from '../../core/connection-ports'
import { routePipe } from '../../design/pipe-route'
import { PoolNode } from '../../core/schema'
import { resolveMountedSkimmer } from '../design/placement'

test('bottom socket matches geometry across housing sizes', () => {
  for (const bodyHeight of [0.25, 0.55, 0.9]) {
    const node = PoolSkimmerNode.parse({ bodyHeight, bodyDepth: 0.5, waterlineOffset: -0.1 })
    const port = getSkimmerPortsLocal(node)[0]!
    const geometry = buildSkimmerGeometry(node)
    try {
      expect(port.direction).toEqual([0, -1, 0])
      expect(port.position[1]).toBeLessThan(node.waterlineOffset - bodyHeight)
      const ring = new Box3().setFromObject(geometry.getObjectByName('suction-socket-ring')!)
      const collar = new Box3().setFromObject(geometry.getObjectByName('suction-socket-opening')!)
      const neck = new Box3().setFromObject(geometry.getObjectByName('suction-outlet-neck')!)
      const throat = new Box3().setFromObject(geometry.getObjectByName('suction-throat')!)
      expect(ring.min.y).toBeCloseTo(port.position[1])
      expect(collar.min.y).toBeCloseTo(port.position[1])
      expect(collar.getCenter(new Vector3()).x).toBeCloseTo(port.position[0])
      expect(collar.intersectsBox(neck)).toBe(true)
      expect(neck.intersectsBox(throat)).toBe(true)
      expect(throat.max.z).toBeCloseTo(0)
    } finally { disposeObject3D(geometry) }
  }
})

test('mounted skimmer suction starts below the surround and routes downward', () => {
  const pool = PoolNode.parse({ position: [3, 2, 4], designWaterElevation: -0.12 })
  const stale = PoolSkimmerNode.parse({ poolId: pool.id, position: [0, 10, 0] })
  const mounted = resolveMountedSkimmer(stale, pool)
  const port = connectionPorts(mounted, getSkimmerPortsLocal(mounted))[0]!
  expect(port.position[1]).toBeCloseTo(2 - 0.12 - 0.55 - 0.018)
  expect(port.direction).toEqual([0, -1, 0])
  const start: [number, number, number] = [...port.position]
  const end: [number, number, number] = [start[0] + 4, start[1], start[2]]
  const route = routePipe(start, end, [0, -1, 0], [0, -1, 0], [], 0.3, 0.07, -1)
  expect(route).not.toBeNull()
  expect(route![1]![1]).toBeLessThan(start[1])
  expect(route!.every(point => point[1] <= start[1])).toBe(true)
  expect(stale.position).toEqual([0, 10, 0])
})
