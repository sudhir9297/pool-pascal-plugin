import { describe, expect, test } from 'bun:test'
import { createPipeNetwork } from '../../design/pipe-network'
import { collectPipePorts, findNearestPipeBody, findNearestPipePort, findNearestPoolPipeTarget, findPipeCrossing } from './ports'

describe('PVC connection ports and run-body snapping', () => {
  test('collects open endpoints and preserves their elevation when snapping in plan', () => {
    const network = createPipeNetwork({ id: 'ports-run', parentId: null, start: [0, 1.2, 0], end: [4, 1.2, 0] })
    const ports = collectPipePorts([network], false)
    const nearest = findNearestPipePort([4.05, 0, 0.02], ports, 0.2)

    expect(nearest?.id).toBe('ports-run:n1')
    expect(nearest?.position).toEqual([4, 1.2, 0])
    expect(nearest?.direction).toEqual([1, 0, 0])
  })

  test('finds an interior body tap and excludes pipe ends', () => {
    const network = createPipeNetwork({ id: 'body-run', parentId: null, start: [0, 1, 0], end: [4, 1, 0] })
    const hit = findNearestPipeBody([2, 3, 0.05], [network], { maxDistance: 0.1, endMargin: 0.2 })
    const endHit = findNearestPipeBody([0, 1, 0], [network], { maxDistance: 0.1, endMargin: 0.2 })

    expect(hit?.edgeId).toBe('e0')
    expect(hit?.position).toEqual([2, 1, 0])
    expect(hit?.t).toBeCloseTo(0.5)
    expect(endHit).toBeNull()
  })

  test('normalizes an interior pipe target without confusing it with an open endpoint', () => {
    const network = createPipeNetwork({ id: 'target-run', parentId: null, start: [0, 1, 0], end: [4, 1, 0] })
    const ports = collectPipePorts([network], false)
    const target = findNearestPoolPipeTarget([2, 1, 0.04], ports, [network])

    expect(target?.pipeConnection).toEqual({ networkId: 'target-run', edgeId: 'e0', position: [2, 1, 0] })
    expect(target?.pipeBody?.segmentIndex).toBe(0)
  })

  test('finds a same-level interior crossing and rejects a different elevation', () => {
    const trunk = createPipeNetwork({ id: 'cross-trunk', parentId: null, start: [-2, 1, 0], end: [2, 1, 0] })
    const crossing = findPipeCrossing([0, 1, -2], [0, 1, 2], [trunk])
    const elevated = findPipeCrossing([0, 1.5, -2], [0, 1.5, 2], [trunk])

    expect(crossing).toMatchObject({ networkId: 'cross-trunk', edgeId: 'e0', drawnT: 0.5, trunkT: 0.5 })
    expect(crossing?.position).toEqual([0, 1, 0])
    expect(elevated).toBeNull()
  })

  test('uses deterministic connection priority over raw distance', () => {
    const ports = [
      { id: 'pipe-endpoint', ownerId: 'pipe-1', kind: 'pipe-endpoint' as const, position: [0.01, 0, 0] as [number, number, number], direction: [1, 0, 0] as [number, number, number] },
      { id: 'equipment-port', ownerId: 'valve-1', kind: 'equipment' as const, position: [0.08, 0, 0] as [number, number, number], direction: [1, 0, 0] as [number, number, number] },
    ]
    expect(findNearestPipePort([0, 0, 0], ports, 0.2)?.id).toBe('equipment-port')
    expect(findNearestPoolPipeTarget([0, 0, 0], ports, [], { portDistance: 0.2 })?.port?.id).toBe('equipment-port')
  })

  test('can disable automatic connection snapping while drawing', () => {
    const network = createPipeNetwork({ id: 'snap-disabled', parentId: null, start: [0, 1, 0], end: [4, 1, 0] })
    const ports = collectPipePorts([network], false)

    expect(findNearestPoolPipeTarget([2, 1, 0.04], ports, [network], { connectionSnap: false })).toBeNull()
  })
})
