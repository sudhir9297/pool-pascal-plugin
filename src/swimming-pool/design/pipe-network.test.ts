import { describe, expect, test } from 'bun:test'
import { addPipeIntersectionFittings, addPipeIntersectionFittingsToNetworks, appendPipePoint, attachPipeNode, branchPipePoint, connectPipeNetworkAtPoint, createPipeNetwork, createPipeNetworkFromPoints, deletePipeEdge, derivePipeFittingKind, detachPipeNode, findAnchoredPipeNodeIds, findNearestPipeConnection, getPipeEdgeEndpointIds, getPipeNodeAttachment, insertPipePoint, mergePipeNetworksAtEndpoints, movePipeEndpoint, movePipeEndpointByVector, movePipeEndpointTo, movePipeNode, movePipeNodeAcrossNetworks, normalizePipeNetworkEdgeIds, preparePipeNetworkForCommit, rotatePipeBranch, slidePipeEdge, syncAttachedPipeEndpoints, validatePipeNetwork } from './pipe-network'

describe('pipe network graph', () => {
  test('rotates only the selected branch around a fitting pivot', () => {
    const network = createPipeNetworkFromPoints('pipe_network_rotation', 'level_ground', [
      [-2, 0, 0],
      [0, 0, 0],
      [2, 0, 0],
      [4, 0, 0],
    ])
    const rotated = rotatePipeBranch(network, 'n1', 'n2', Math.PI / 2)
    expect(rotated.nodes.find((node) => node.id === 'n1')?.position).toEqual([0, 0, 0])
    expect(rotated.nodes.find((node) => node.id === 'n0')?.position).toEqual([-2, 0, 0])
    expect(rotated.nodes.find((node) => node.id === 'n2')?.position[0]).toBeCloseTo(0)
    expect(rotated.nodes.find((node) => node.id === 'n2')?.position[2]).toBeCloseTo(-2)
    expect(rotated.nodes.find((node) => node.id === 'n3')?.position[2]).toBeCloseTo(-4)
  })

  test('creates an open PVC run from two points', () => {
    const network = createPipeNetwork({
      id: 'pipe_network_1',
      parentId: 'level_ground',
      start: [1, 0, 2],
      end: [4, 0, 2],
    })

    expect(network.type).toBe('pool:pipe-network')
    expect(network.kitId).toBe('pvc')
    expect(network.nodes).toEqual([
      { id: 'n0', position: [1, 0, 2], kind: 'endpoint' },
      { id: 'n1', position: [4, 0, 2], kind: 'endpoint' },
    ])
    expect(network.edges).toEqual([
      { id: 'e0', from: 'n0', to: 'n1', style: 'rigid' },
    ])
  })

  test('extends an open endpoint without changing the existing run', () => {
    const network = createPipeNetwork({
      id: 'pipe_network_2',
      parentId: 'level_ground',
      start: [0, 0, 0],
      end: [2, 0, 0],
    })

    const extended = appendPipePoint(network, 'n1', [2, 0, 3])

    expect(extended.nodes).toEqual([
      { id: 'n0', position: [0, 0, 0], kind: 'endpoint' },
      { id: 'n1', position: [2, 0, 0], kind: 'elbow' },
      { id: 'n2', position: [2, 0, 3], kind: 'endpoint' },
    ])
    expect(extended.edges).toEqual([
      { id: 'e0', from: 'n0', to: 'n1', style: 'rigid' },
      { id: 'e1', from: 'n1', to: 'n2', style: 'rigid' },
    ])
    expect(network.nodes[1]?.position).toEqual([2, 0, 0])
  })

  test('creates a connected rigid path from drawn points', () => {
    const network = createPipeNetworkFromPoints('pipe_network_3', 'level_ground', [
      [0, 0, 0],
      [2, 0, 0],
      [2, 0, 3],
    ])

    expect(network.nodes.map((node) => node.kind)).toEqual(['endpoint', 'elbow', 'endpoint'])
    expect(network.edges.map(({ from, to }) => [from, to])).toEqual([
      ['n0', 'n1'],
      ['n1', 'n2'],
    ])
  })

  test('moves an open endpoint along its existing pipe axis', () => {
    const network = createPipeNetwork({
      id: 'pipe_network_4',
      parentId: 'level_ground',
      start: [0, 0, 0],
      end: [2, 0, 0],
    })

    const moved = movePipeEndpoint(network, 'n1', 1)

    expect(moved.nodes[1]?.position).toEqual([3, 0, 0])
    expect(moved.nodes[0]?.position).toEqual([0, 0, 0])
  })

  test('keeps a shortened endpoint just beyond its neighbor', () => {
    const network = createPipeNetwork({
      id: 'pipe_network_5',
      parentId: 'level_ground',
      start: [0, 0, 0],
      end: [2, 0, 0],
    })

    const shortened = movePipeEndpoint(network, 'n1', -3)

    expect(shortened.nodes[1]?.position).toEqual([0.1, 0, 0])
  })

  test('moves an open endpoint by an arbitrary gizmo vector', () => {
    const network = createPipeNetwork({ id: 'pipe-vector', parentId: null, start: [0, 0, 0], end: [2, 0, 0] })
    const moved = movePipeEndpointByVector(network, 'n1', [0.5, 1, -0.25])

    expect(moved.nodes.find((node) => node.id === 'n1')?.position).toEqual([2.5, 1, -0.25])
  })

  test('inserts a straight node into an existing segment', () => {
    const network = createPipeNetwork({
      id: 'pipe_network_6',
      parentId: 'level_ground',
      start: [0, 0, 0],
      end: [4, 0, 0],
    })

    const split = insertPipePoint(network, 'e0', [2, 0, 0])

    expect(split.nodes).toEqual([
      { id: 'n0', position: [0, 0, 0], kind: 'endpoint' },
      { id: 'n1', position: [4, 0, 0], kind: 'endpoint' },
      { id: 'n2', position: [2, 0, 0], kind: 'straight' },
    ])
    expect(split.edges).toEqual([
      { id: 'e1', from: 'n0', to: 'n2', style: 'rigid' },
      { id: 'e2', from: 'n2', to: 'n1', style: 'rigid' },
    ])
  })

  test('keeps edge ids unique when inserting repeatedly into an edited run', () => {
    const network = createPipeNetwork({ id: 'pipe_repeated_insert', parentId: null, start: [0, 0, 0], end: [4, 0, 0] })
    const first = insertPipePoint(network, 'e0', [2, 0, 0])
    const second = insertPipePoint(first, 'e2', [3, 0, 0])

    expect(second.edges.map((edge) => edge.id)).toEqual(['e1', 'e3', 'e4'])
    expect(new Set(second.edges.map((edge) => edge.id)).size).toBe(second.edges.length)
    expect(second.edges.map(({ from, to }) => [from, to])).toEqual([
      ['n0', 'n2'], ['n2', 'n3'], ['n3', 'n1'],
    ])
  })

  test('repairs duplicate edge ids left by older edited networks', () => {
    const network = createPipeNetwork({ id: 'pipe_legacy_ids', parentId: null, start: [0, 0, 0], end: [4, 0, 0] })
    const legacy = {
      ...network,
      edges: [
        { id: 'e1', from: 'n0', to: 'n1', style: 'rigid' as const },
        { id: 'e2', from: 'n1', to: 'n0', style: 'rigid' as const },
        { id: 'e2', from: 'n0', to: 'n1', style: 'rigid' as const },
      ],
    }
    const repaired = normalizePipeNetworkEdgeIds(legacy)

    expect(repaired.edges.map((edge) => edge.id)).toEqual(['e1', 'e2', 'e3'])
    expect(new Set(repaired.edges.map((edge) => edge.id)).size).toBe(repaired.edges.length)
  })

  test('prepares a committed graph with unique edge ids and current fitting kinds', () => {
    const legacy = createPipeNetworkFromPoints('pipe_network_commit', 'level_ground', [
      [0, 0, 0], [2, 0, 0], [2, 0, 2],
    ])
    const prepared = preparePipeNetworkForCommit({
      ...legacy,
      edges: legacy.edges.map((edge) => ({ ...edge, id: 'duplicate' })),
      nodes: legacy.nodes.map((node) => node.id === 'n1' ? { ...node, kind: 'straight' } : node),
    })

    expect(new Set(prepared.edges.map((edge) => edge.id)).size).toBe(prepared.edges.length)
    expect(prepared.nodes.find((node) => node.id === 'n1')?.kind).toBe('elbow')
  })

  test('branches from an inserted node and promotes it to a tee', () => {
    const network = insertPipePoint(createPipeNetwork({
      id: 'pipe_network_7',
      parentId: 'level_ground',
      start: [0, 0, 0],
      end: [4, 0, 0],
    }), 'e0', [2, 0, 0])

    const branched = branchPipePoint(network, 'n2', [2, 0, 3])

    expect(branched.nodes.find((node) => node.id === 'n2')?.kind).toBe('tee')
    expect(branched.edges.at(-1)).toEqual({ id: 'e3', from: 'n2', to: 'n3', style: 'rigid' })
  })

  test('branches from an L corner and promotes the elbow to a tee', () => {
    const lShape = createPipeNetworkFromPoints('pipe_l_corner', null, [
      [0, 0, 0], [2, 0, 0], [2, 0, 2],
    ])

    const branched = branchPipePoint(lShape, 'n1', [2, 0, -2])

    expect(branched.nodes.find((node) => node.id === 'n1')?.kind).toBe('tee')
    expect(branched.edges.at(-1)).toEqual({ id: 'e2', from: 'n1', to: 'n3', style: 'rigid' })
  })

  test('deletes only a selected branch and restores the cut run', () => {
    const trunk = insertPipePoint(createPipeNetwork({
      id: 'pipe_delete_branch', parentId: null, start: [-2, 0, 0], end: [2, 0, 0],
    }), 'e0', [0, 0, 0])
    const tee = branchPipePoint(trunk, 'n2', [0, 0, 2])
    const updated = deletePipeEdge(tee, 'e3')

    expect(updated.edges).toEqual([
      { id: 'e1', from: 'n0', to: 'n1', style: 'rigid' },
    ])
    expect(updated.nodes).toHaveLength(2)
    expect(updated.nodes.find((node) => node.id === 'n2')).toBeUndefined()
    expect(updated.nodes.some((node) => node.id === 'n3')).toBe(false)
  })

  test('derives Y and cross fittings from branch directions', () => {
    const y = branchPipePoint(insertPipePoint(createPipeNetwork({
      id: 'pipe_y', parentId: null, start: [-2, 0, 0], end: [2, 0, 0],
    }), 'e0', [0, 0, 0]), 'n2', [0, 0, 2])
    expect(derivePipeFittingKind(y, 'n2')).toBe('tee')

    const cross = branchPipePoint(y, 'n2', [0, 0, -2])
    expect(derivePipeFittingKind(cross, 'n2')).toBe('cross')

    const diagonalY = branchPipePoint(insertPipePoint(createPipeNetwork({
      id: 'pipe_diagonal_y', parentId: null, start: [-1, 0, 0], end: [1, 0, 1],
    }), 'e0', [0, 0, 0]), 'n2', [0, 0, -1])
    expect(derivePipeFittingKind(diagonalY, 'n2')).toBe('y')
  })

  test('keeps a shallow visible bend as an elbow instead of a straight run', () => {
    const angle = (15 * Math.PI) / 180
    const shallowBend = createPipeNetworkFromPoints('pipe_shallow_bend', null, [
      [-2, 0, 0],
      [0, 0, 0],
      [2 * Math.cos(angle), 0, 2 * Math.sin(angle)],
    ])

    expect(derivePipeFittingKind(shallowBend, 'n1')).toBe('elbow')
  })

  test('splits crossing networks and marks the crossing node as a cross fitting', () => {
    const horizontal = createPipeNetwork({ id: 'pipe_cross_horizontal', parentId: null, start: [-2, 0, 0], end: [2, 0, 0] })
    const vertical = createPipeNetwork({ id: 'pipe_cross_vertical', parentId: null, start: [0, 0, -2], end: [0, 0, 2] })

    const updated = addPipeIntersectionFittings(horizontal, [vertical])
    const crossing = updated.nodes.find((node) => node.kind === 'cross')

    expect(crossing?.position).toEqual([0, 0, 0])
    expect(updated.edges).toHaveLength(2)
    expect(addPipeIntersectionFittings(vertical, [horizontal]).nodes.some((node) => node.kind === 'cross')).toBe(true)
  })

  test('resolves every network crossing symmetrically at one shared location', () => {
    const horizontal = createPipeNetwork({ id: 'topology-horizontal', parentId: null, start: [-2, 0, 0], end: [2, 0, 0] })
    const vertical = createPipeNetwork({ id: 'topology-vertical', parentId: null, start: [0, 0, -2], end: [0, 0, 2] })
    const [resolvedHorizontal, resolvedVertical] = addPipeIntersectionFittingsToNetworks([horizontal, vertical])

    expect(resolvedHorizontal?.nodes.find((node) => node.kind === 'cross')?.position).toEqual([0, 0, 0])
    expect(resolvedVertical?.nodes.find((node) => node.kind === 'cross')?.position).toEqual([0, 0, 0])
    expect(resolvedHorizontal?.edges).toHaveLength(2)
    expect(resolvedVertical?.edges).toHaveLength(2)
  })

  test('snaps to a pipe and joins a new run as a tee', () => {
    const existing = createPipeNetwork({ id: 'pipe_join_existing', parentId: null, start: [-2, 0, 0], end: [2, 0, 0] })
    const incoming = createPipeNetwork({ id: 'pipe_join_incoming', parentId: null, start: [0, 0, -2], end: [0, 0, 0] })
    const target = findNearestPipeConnection([0.04, 0, 0.04], [existing])
    expect(target).toMatchObject({ networkId: existing.id, edgeId: 'e0' })
    expect(target!.position[0]).toBeCloseTo(0.04)
    const joined = connectPipeNetworkAtPoint(existing, incoming, target!.edgeId, target!.position)
    expect(joined.nodes.find((node) => Math.abs(node.position[0] - 0.04) < 1e-6 && node.position[2] === 0)?.kind).toBe('tee')
    expect(joined.edges).toHaveLength(3)
  })

  test('can join when the first endpoint is snapped to an existing pipe', () => {
    const existing = createPipeNetwork({ id: 'pipe_start_join_existing', parentId: null, start: [-2, 0, 0], end: [2, 0, 0] })
    const incoming = createPipeNetwork({ id: 'pipe_start_join_incoming', parentId: null, start: [0, 0, 0], end: [0, 0, 2] })
    const joined = connectPipeNetworkAtPoint(existing, incoming, 'e0', [0, 0, 0], 'n0')
    expect(joined.nodes.find((node) => Math.abs(node.position[0]) < 1e-6 && Math.abs(node.position[2]) < 1e-6)?.kind).toBe('tee')
    expect(joined.edges).toHaveLength(3)
  })

  test('reuses an existing corner when tapping an already-extended run', () => {
    const existing = createPipeNetworkFromPoints('pipe_tap_corner', null, [
      [-3, 0, 0], [0, 0, 0], [0, 0, 3],
    ])
    const incoming = createPipeNetwork({
      id: 'pipe_tap_branch', parentId: null, start: [0, 0, -2], end: [0, 0, 0],
    })

    const joined = connectPipeNetworkAtPoint(existing, incoming, 'e0', [0, 0, 0])
    const junctionsAtTap = joined.nodes.filter((node) => node.position[0] === 0 && node.position[2] === 0)

    expect(junctionsAtTap).toHaveLength(1)
    expect(junctionsAtTap[0]?.id).toBe('n1')
    expect(junctionsAtTap[0]?.kind).toBe('tee')
    expect(joined.edges).toHaveLength(3)
    expect(joined.nodes.find((node) => node.id === 'n2')?.position).toEqual([0, 0, 3])
  })

  test('moves a junction node and keeps its connected edges attached', () => {
    const network = createPipeNetworkFromPoints('pipe_move_junction', null, [
      [-2, 0, 0], [0, 0, 0], [0, 0, 2],
    ])
    const moved = movePipeNode(network, 'n1', [1, 0, -0.5])
    expect(moved.nodes.find((node) => node.id === 'n1')?.position).toEqual([1, 0, -0.5])
    expect(moved.edges).toEqual(network.edges)
    expect(moved.nodes.find((node) => node.id === 'n1')?.kind).toBe('elbow')
  })

  test('propagates a shared junction move to every intersecting network', () => {
    const [horizontal, vertical] = addPipeIntersectionFittingsToNetworks([
      createPipeNetwork({ id: 'move-shared-horizontal', parentId: null, start: [-2, 0, 0], end: [2, 0, 0] }),
      createPipeNetwork({ id: 'move-shared-vertical', parentId: null, start: [0, 0, -2], end: [0, 0, 2] }),
    ])
    const junction = horizontal!.nodes.find((node) => node.kind === 'cross')!
    const moved = movePipeNodeAcrossNetworks([horizontal!, vertical!], horizontal!.id, junction.id, [0, 1, 0])

    expect(moved[0]?.nodes.find((node) => node.id === junction.id)?.position).toEqual([0, 1, 0])
    expect(moved[1]?.nodes.find((node) => node.kind === 'cross')?.position).toEqual([0, 1, 0])
  })

  test('slides an edge by moving both endpoints together', () => {
    const network = createPipeNetworkFromPoints('pipe_slide_edge', null, [
      [-2, 0, 0], [0, 0, 0], [0, 0, 2],
    ])
    const moved = slidePipeEdge(network, 'e0', [0, 0, 1])
    expect(moved.nodes.find((node) => node.id === 'n0')?.position).toEqual([-2, 0, 1])
    expect(moved.nodes.find((node) => node.id === 'n1')?.position).toEqual([0, 0, 1])
    expect(moved.nodes.find((node) => node.id === 'n2')?.position).toEqual([0, 0, 2])
  })

  test('identifies equipment-attached nodes and edge endpoints', () => {
    const network = createPipeNetworkFromPoints('pipe_anchors', null, [[0, 0, 0], [2, 0, 0], [2, 0, 2]])
    expect(findAnchoredPipeNodeIds(network, [[0.01, 0, 0]])).toEqual(new Set(['n0']))
    expect(getPipeEdgeEndpointIds(network, 'e1')).toEqual(['n1', 'n2'])
  })

  test('persists and removes an endpoint attachment without changing graph topology', () => {
    const network = createPipeNetwork({ id: 'pipe_attachment', parentId: null, start: [0, 1, 0], end: [2, 1, 0] })
    const attached = attachPipeNode(network, 'n0', { ownerId: 'pool-valve_1', portId: 'pool-valve_1:port:0', kind: 'equipment' })

    expect(getPipeNodeAttachment(attached, 'n0')).toEqual({ nodeId: 'n0', ownerId: 'pool-valve_1', portId: 'pool-valve_1:port:0', kind: 'equipment' })
    expect(attached.edges).toEqual(network.edges)
    expect(detachPipeNode(attached, 'n0').attachments).toEqual([])
  })

  test('retains non-join attachments when two networks are merged', () => {
    const existing = createPipeNetwork({ id: 'merge-existing', parentId: null, start: [-2, 0, 0], end: [2, 0, 0] })
    const incoming = attachPipeNode(
      createPipeNetwork({ id: 'merge-incoming', parentId: null, start: [0, 0, -2], end: [0, 0, 2] }),
      'n0',
      { ownerId: 'pool-drain_1', portId: 'pool-drain_1:socket', kind: 'equipment' },
    )
    const merged = connectPipeNetworkAtPoint(existing, incoming, 'e0', [0, 0, 0], 'n1')

    expect(merged.attachments).toEqual([
      { nodeId: 'n3', ownerId: 'pool-drain_1', portId: 'pool-drain_1:socket', kind: 'equipment' },
    ])
  })

  test('keeps an attachment while moving an endpoint and removes it only when detached', () => {
    const network = attachPipeNode(
      createPipeNetwork({ id: 'move-attached', parentId: null, start: [0, 0, 0], end: [2, 0, 0] }),
      'n1',
      { ownerId: 'pool-valve_2', portId: 'pool-valve_2:port:0', kind: 'equipment' },
    )
    expect(getPipeNodeAttachment(movePipeEndpointByVector(network, 'n1', [0, 1, 0]), 'n1')).not.toBeNull()
    expect(getPipeNodeAttachment(movePipeEndpointByVector(network, 'n1', [0, 1, 0], { detach: true }), 'n1')).toBeNull()
  })

  test('constrains an attached endpoint to its equipment port position', () => {
    const network = attachPipeNode(
      createPipeNetwork({ id: 'sync-equipment-port', parentId: null, start: [0, 0, 0], end: [2, 0, 0] }),
      'n1',
      { ownerId: 'pool-inlet_sync', portId: 'pool-inlet_sync:port:0', kind: 'equipment' },
    )
    const synced = syncAttachedPipeEndpoints(network, [{
      ownerId: 'pool-inlet_sync', id: 'pool-inlet_sync:port:0', position: [3, 0.5, 1],
    }])
    expect(synced.nodes.find((node) => node.id === 'n1')?.position).toEqual([3, 0.5, 1])
    expect(syncAttachedPipeEndpoints(synced, [{
      ownerId: 'pool-inlet_sync', id: 'pool-inlet_sync:port:0', position: [3, 0.5, 1],
    }])).toBe(synced)
  })

  test('reports invalid fitting topology for feedback', () => {
    const invalid = createPipeNetwork({ id: 'invalid-fitting', parentId: null, start: [0, 0, 0], end: [0, 0, 0] })
    const issues = validatePipeNetwork(invalid)
    expect(issues.some((issue) => issue.code === 'short-edge')).toBe(true)
    expect(issues.filter((issue) => issue.code === 'invalid-degree')).toHaveLength(0)
  })

  test('re-aims the neighboring fitting when an endpoint is moved to an exact target', () => {
    const network = createPipeNetworkFromPoints('reaim-endpoint', null, [
      [0, 0, 0], [2, 0, 0], [2, 0, 2],
    ])
    const reaimed = movePipeEndpointTo(network, 'n2', [4, 0, 0])

    expect(reaimed.nodes.find((node) => node.id === 'n2')?.position).toEqual([4, 0, 0])
    expect(reaimed.nodes.find((node) => node.id === 'n1')?.kind).toBe('straight')
  })

  test('prevents endpoint re-aiming from creating a zero-length edge', () => {
    const network = createPipeNetworkFromPoints('reaim-min-length', null, [
      [0, 0, 0], [2, 0, 0], [2, 0, 2],
    ])
    const reaimed = movePipeEndpointTo(network, 'n2', [2, 0, 0])
    expect(reaimed.nodes.find((node) => node.id === 'n2')?.position).toEqual([2, 0, 0.1])
  })

  test('merges two open pipe runs at their endpoints', () => {
    const target = createPipeNetwork({ id: 'endpoint-merge-target', parentId: null, start: [0, 0, 0], end: [2, 0, 0] })
    const source = attachPipeNode(
      createPipeNetwork({ id: 'endpoint-merge-source', parentId: null, start: [2, 0, 0], end: [2, 0, 2] }),
      'n0',
      { ownerId: 'pool-valve_merge', portId: 'pool-valve_merge:port:0', kind: 'equipment' },
    )
    const merged = mergePipeNetworksAtEndpoints(target, source, 'n1', 'n0')

    expect(merged.nodes).toHaveLength(3)
    expect(merged.edges).toHaveLength(2)
    expect(merged.nodes.find((node) => node.id === 'n1')?.kind).toBe('elbow')
    expect(getPipeNodeAttachment(merged, 'n1')).toEqual({
      nodeId: 'n1', ownerId: 'pool-valve_merge', portId: 'pool-valve_merge:port:0', kind: 'equipment',
    })
  })
})
