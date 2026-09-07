import { describe, expect, test } from 'bun:test'
import { findNearestValveConnection } from './placement'
import { PoolValveNode } from '../core/schema'

describe('pool valve placement', () => {
  test('snaps to each exposed valve port', () => {
    const valve = PoolValveNode.parse({ position: [1, 0, 2], variant: 'three-way' })
    const connection = findNearestValveConnection([1.25, 0, 2], [valve])
    expect(connection?.position[0]).toBeCloseTo(1.28)
    expect(connection?.position[1]).toBeCloseTo(0)
    expect(connection?.position[2]).toBeCloseTo(2)
  })

  test('rotates the snap point with the valve', () => {
    const valve = PoolValveNode.parse({ rotation: [0, Math.PI / 2, 0] })
    const connection = findNearestValveConnection([0.28, 0, 0], [valve])
    expect(connection?.position[0]).toBeCloseTo(0.28)
    expect(connection?.position[2]).toBeCloseTo(0)
  })
})
