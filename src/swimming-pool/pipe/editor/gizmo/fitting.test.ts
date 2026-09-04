import { describe, expect, test } from 'bun:test'
import { branchPipePoint, createPipeNetworkFromPoints, insertPipePoint } from '../../../design/pipe-network'
import { getPipeFittingGizmoTarget } from './fitting'

describe('PVC fitting gizmo targets', () => {
  test('exposes only axes represented by a fitting connection', () => {
    const network = branchPipePoint(
      insertPipePoint(createPipeNetworkFromPoints('pipe_t_gizmo', null, [[-2, 0, 0], [2, 0, 0]]), 'e0', [0, 0, 0]),
      'n2',
      [0, 0, 2],
    )
    const target = getPipeFittingGizmoTarget(network, 'n2')
    expect(target?.kind).toBe('tee')
    expect(target?.validAxes).toContain('x')
    expect(target?.validAxes).toContain('z')
  })

  test('resolves a gizmo from topology when a stored fitting kind is stale', () => {
    const network = createPipeNetworkFromPoints('pipe_legacy_corner', null, [
      [0, 0, 0],
      [2, 0, 0],
      [2, 0, 2],
    ])
    const stale = {
      ...network,
      nodes: network.nodes.map((node) => node.id === 'n1'
        ? { ...node, kind: 'corner' as const }
        : node),
    }

    expect(getPipeFittingGizmoTarget(stale, 'n1')?.kind).toBe('elbow')
  })
})
