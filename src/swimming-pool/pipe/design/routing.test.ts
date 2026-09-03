import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../../core/schema'
import { PoolPipeNode } from '../core/schema'
import { PoolSkimmerNode } from '../../skimmer/core/schema'
import { getSkimmerPipeConnection } from '../../skimmer/design/placement'
import { routePipeOutsidePools, validatePipeSocketUse } from './routing'
import { PoolValveNode } from '../../valve/core/schema'
import { getValvePortPositions } from '../../valve/core/geometry'
import { PoolDrainNode } from '../../drain/core/schema'
import { getDrainPipeConnection } from '../../drain/design/placement'
import { PoolInletNode } from '../../inlet/core/schema'
import { getInletPipeConnection } from '../../inlet/design/placement'

describe('PVC routing and connection validation', () => {
  test('routes a pipe around the pool instead of through its basin', () => {
    const pool = PoolNode.parse({ id: 'pool_route', position: [0, 0, 0], length: 8, width: 4 })
    const route = routePipeOutsidePools([-5, -0.4, 0], [5, -0.4, 0], [pool])

    expect(route.length).toBeGreaterThan(2)
    expect(route[0]).toEqual([-5, -0.4, 0])
    expect(route.at(-1)).toEqual([5, -0.4, 0])
  })

  test('rejects a second pipe on the same skimmer suction port', () => {
    const skimmer = PoolSkimmerNode.parse({ id: 'pool-skimmer_validation', position: [0, -0.12, 0] })
    const connection = getSkimmerPipeConnection(skimmer)
    const existing = PoolPipeNode.parse({ id: 'pipe-network_existing', nodes: [
      { id: 'n0', position: connection.position, kind: 'endpoint' },
      { id: 'n1', position: [2, -0.43, 0], kind: 'endpoint' },
    ], edges: [{ id: 'e0', from: 'n0', to: 'n1', style: 'rigid' }] })

    expect(validatePipeSocketUse([connection.position, [3, -0.43, 0]], [skimmer], [existing]).valid).toBe(false)
  })

  test('rejects a second pipe on the same valve port', () => {
    const valve = PoolValveNode.parse({ id: 'pool-valve_validation', position: [0, 0, 0] })
    const port = getValvePortPositions(valve)[0]!
    const portPoint: [number, number, number] = [port.x, port.y, port.z]
    const existing = PoolPipeNode.parse({ id: 'pipe-network_valve_existing', nodes: [
      { id: 'n0', position: portPoint, kind: 'endpoint' },
      { id: 'n1', position: [2, 0, 0], kind: 'endpoint' },
    ], edges: [{ id: 'e0', from: 'n0', to: 'n1', style: 'rigid' }] })

    expect(validatePipeSocketUse([portPoint, [3, 0, 0]], [], [existing], undefined, [valve]).valid).toBe(false)
  })

  test('rejects a second pipe on the same pool drain', () => {
    const drain = PoolDrainNode.parse({ id: 'pool-drain_validation', position: [0, -0.2, 0] })
    const connection = getDrainPipeConnection(drain)
    const existing = PoolPipeNode.parse({ id: 'pipe-network_drain_existing', nodes: [
      { id: 'n0', position: connection.position, kind: 'endpoint' },
      { id: 'n1', position: [2, -0.4, 0], kind: 'endpoint' },
    ], edges: [{ id: 'e0', from: 'n0', to: 'n1', style: 'rigid' }] })

    expect(validatePipeSocketUse([connection.position, [3, -0.4, 0]], [], [existing], undefined, [], [drain]).valid).toBe(false)
  })

  test('rejects a second pipe on the same pool return inlet', () => {
    const inlet = PoolInletNode.parse({ id: 'pool-inlet_validation', position: [0, 0, 0] })
    const connection = getInletPipeConnection(inlet)
    const existing = PoolPipeNode.parse({ id: 'pipe-network_inlet_existing', nodes: [
      { id: 'n0', position: connection.position, kind: 'endpoint' },
      { id: 'n1', position: [3, 0, 0], kind: 'endpoint' },
    ], edges: [{ id: 'e0', from: 'n0', to: 'n1', style: 'rigid' }] })
    expect(validatePipeSocketUse([connection.position, [3, 0, 0]], [], [existing], undefined, [], [], [inlet]).valid).toBe(false)
  })
})
