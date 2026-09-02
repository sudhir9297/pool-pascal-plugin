import { describe, expect, test } from 'bun:test'
import { PoolNode } from '../../core/schema'
import { findNearestPoolWall, findNearestSkimmerConnection, getSkimmerPipeConnection } from './placement'

describe('pool skimmer placement', () => {
  test('snaps to the nearest pool wall and aims into the basin', () => {
    const pool = PoolNode.parse({ id: 'pool_placement', position: [2, 0, 3], length: 8, width: 4 })
    const placement = findNearestPoolWall([5.8, 3], [pool])

    expect(placement?.position).toEqual([6, -0.12, 3])
    expect(placement?.rotation).toEqual([0, -Math.PI / 2, 0])
  })

  test('keeps a flat wall orientation constant along the wall', () => {
    const pool = PoolNode.parse({ id: 'pool_flat_wall', position: [0, 0, 0], length: 8, width: 4 })
    const nearLeft = findNearestPoolWall([-4.2, -1], [pool])
    const nearLeftCorner = findNearestPoolWall([-4.2, 1], [pool])

    expect(nearLeft?.rotation).toEqual([0, Math.PI / 2, 0])
    expect(nearLeftCorner?.rotation).toEqual([0, Math.PI / 2, 0])
  })

  test('provides a rotated PVC snap point behind the skimmer', () => {
    const skimmer = {
      id: 'skimmer_socket',
      position: [2, -0.12, 3],
      rotation: [0, -Math.PI / 2, 0],
    }
    const connection = getSkimmerPipeConnection(skimmer as never)
    const snapped = findNearestSkimmerConnection(connection.position, [skimmer as never])

    expect(connection.position).toEqual([2.14, -0.43, 3])
    expect(connection.direction[0]).toBeCloseTo(1)
    expect(connection.direction[1]).toBeCloseTo(0)
    expect(connection.direction[2]).toBeCloseTo(0)
    expect(snapped?.position).toEqual(connection.position)
  })

  test('snaps from the deck-plane hover even when the socket is below it', () => {
    const skimmer = {
      id: 'skimmer_hover',
      position: [0, -0.12, 0],
      rotation: [0, 0, 0],
    }
    const connection = findNearestSkimmerConnection([0, 0, 0], [skimmer as never])

    expect(connection?.position).toEqual([0, -0.43, -0.14])
  })
})
