import { describe, expect, test } from 'bun:test'
import { PoolPipeNode } from '../core/schema'
import { getPipeGizmoDirections, getSelectedEdgeEndpointControls } from './selection-controls'

const network = PoolPipeNode.parse({
  id: 'pipe-network_selection-controls',
  nodes: [
    { id: 'left', position: [0, 0, 0], kind: 'endpoint' },
    { id: 'junction', position: [2, 0, 0], kind: 'tee' },
    { id: 'right', position: [4, 0, 0], kind: 'endpoint' },
    { id: 'branch', position: [2, 0, 2], kind: 'endpoint' },
  ],
  edges: [
    { id: 'left-run', from: 'left', to: 'junction', style: 'rigid' },
    { id: 'right-run', from: 'junction', to: 'right', style: 'rigid' },
    { id: 'branch-run', from: 'junction', to: 'branch', style: 'rigid' },
  ],
})

describe('PVC selected-segment controls', () => {
  test('returns controls only for the selected edge open endpoint', () => {
    expect(getSelectedEdgeEndpointControls(network, 'right-run')).toEqual([
      {
        endpointId: 'right',
        position: [4, 0, 0],
        direction: [1, 0, 0],
      },
    ])

    expect(getSelectedEdgeEndpointControls(network, 'branch-run')).toEqual([
      {
        endpointId: 'branch',
        position: [2, 0, 2],
        direction: [0, 0, 1],
      },
    ])
  })

  test('does not expose controls for another edge or a stale selection', () => {
    expect(getSelectedEdgeEndpointControls(network, 'left-run').map((control) => control.endpointId)).toEqual(['left'])
    expect(getSelectedEdgeEndpointControls(network, 'missing-edge')).toEqual([])
  })

  test('keeps red pipe-outward, green upward, and blue horizontal', () => {
    const directions = getPipeGizmoDirections([-2, 0, -2])
    expect(directions.red[0]).toBeCloseTo(-Math.SQRT1_2)
    expect(directions.red[2]).toBeCloseTo(-Math.SQRT1_2)
    expect(directions.green).toEqual([0, 1, 0])
    expect(directions.blue[1]).toBe(0)
    expect(directions.red[0] * directions.blue[0] + directions.red[2] * directions.blue[2]).toBeCloseTo(0)
  })
})
