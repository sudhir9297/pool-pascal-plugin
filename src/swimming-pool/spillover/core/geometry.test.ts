import { describe, expect, test } from 'bun:test'
import { Color, type Mesh } from 'three'
import type { MeshBasicNodeMaterial } from 'three/webgpu'
import { PoolSpilloverNode } from './schema'
import { buildPoolSpilloverGeometry } from './geometry'

function disposeGeometry(geometry: ReturnType<typeof buildPoolSpilloverGeometry>) {
  geometry.traverse((child) => {
    if ('geometry' in child && child.geometry && typeof child.geometry === 'object' && 'dispose' in child.geometry) {
      (child.geometry as { dispose: () => void }).dispose()
    }
    if ('material' in child) {
      const material = child.material as unknown
      if (Array.isArray(material)) material.forEach((item) => { if (item && typeof item === 'object' && 'dispose' in item) (item as { dispose: () => void }).dispose() })
      else if (material && typeof material === 'object' && 'dispose' in material) (material as { dispose: () => void }).dispose()
    }
  })
}

describe('pool spillover geometry', () => {
  test('builds the flowing sheet without a flat impact overlay', () => {
    const geometry = buildPoolSpilloverGeometry(PoolSpilloverNode.parse({
      sourcePoolId: 'pool-upper',
      targetPoolId: 'pool-lower',
      width: 2.4,
      dropHeight: 0.6,
    }))
    expect(geometry.children.map((child) => child.name)).toEqual([
      'pool-spillover-crest',
      'pool-spillover-overlap-surface',
      'pool-spillover-overlap-wall-left',
      'pool-spillover-overlap-wall-right',
      'pool-spillover-water-sheet',
    ])
    expect(geometry.userData.waterEffects).toHaveLength(1)
    expect(geometry.getObjectByName('pool-spillover-impact')).toBeUndefined()
    disposeGeometry(geometry)
  })

  test('places a direct spillover from its source opening to its receiving opening', () => {
    const geometry = buildPoolSpilloverGeometry(PoolSpilloverNode.parse({
      position: [1.75, 1, 0],
      sourcePoolId: 'pool-upper',
      targetPoolId: 'pool-lower',
      connectionMode: 'overlap',
      connectionPath: [[2, 0], [1.5, 0]],
      length: 0.5,
      width: 2.4,
      lipThickness: 0.08,
      dropHeight: 0.6,
    }))

    expect(geometry.getObjectByName('pool-spillover-crest')?.position.x).toBeCloseTo(0.21)
    // Overlap connections land just outside the source rim rather than
    // extending back through the higher basin.
    expect(geometry.getObjectByName('pool-spillover-water-sheet')?.position.x).toBeCloseTo(-0.03)
    disposeGeometry(geometry)
  })

  test('uses the exact intersecting footprint for an overlap support surface', () => {
    const geometry = buildPoolSpilloverGeometry(PoolSpilloverNode.parse({
      position: [1, 1, 0],
      sourcePoolId: 'pool-upper',
      targetPoolId: 'pool-lower',
      connectionMode: 'overlap',
      connectionPath: [[2, 0], [0, 0]],
      intersection: [[[0.5, -0.75], [1.5, -0.75], [1.5, 0.75], [0.5, 0.75]]],
      width: 2.4,
      dropHeight: 0.6,
    }))
    expect(geometry.getObjectByName('pool-spillover-overlap-surface')).toBeDefined()
    expect(geometry.getObjectByName('pool-spillover-overlap-wall-left')).toBeUndefined()
    expect(geometry.getObjectByName('pool-spillover-overlap-wall-right')).toBeUndefined()
    const surface = geometry.getObjectByName('pool-spillover-overlap-surface') as Mesh
    expect(surface.geometry.getAttribute('position').count).toBe(6)
    disposeGeometry(geometry)
  })

  test('adds no connector meshes for a merged same-level intersection', () => {
    const geometry = buildPoolSpilloverGeometry(PoolSpilloverNode.parse({
      sourcePoolId: 'pool-a',
      targetPoolId: 'pool-b',
      connectionMode: 'overlap',
      mergedSurface: true,
      intersection: [[[0, -1], [1, -1], [1, 1], [0, 1]]],
      connectionPath: [[0, 0], [1, 0]],
      dropHeight: 0.02,
    }))
    expect(geometry.children).toHaveLength(0)
    expect(geometry.userData.waterEffects).toEqual([])
    disposeGeometry(geometry)
  })

  test('builds a watercourse and places the falling sheet at the receiving end', () => {
    const geometry = buildPoolSpilloverGeometry(PoolSpilloverNode.parse({
      sourcePoolId: 'pool-upper',
      targetPoolId: 'pool-lower',
      connectionMode: 'channel',
      sourceSide: 1,
      length: 1.25,
      width: 2.4,
      dropHeight: 0.6,
    }))

    expect(geometry.children.map((child) => child.name)).toEqual([
      'pool-spillover-crest',
      'pool-spillover-channel-bed',
      'pool-spillover-channel-wall-left',
      'pool-spillover-channel-wall-right',
      'pool-spillover-channel-outer-border-left',
      'pool-spillover-channel-outer-border-right',
      'pool-spillover-water-sheet',
    ])
    expect(geometry.getObjectByName('pool-spillover-crest')?.position.x).toBeCloseTo(0.585)
    expect(geometry.getObjectByName('pool-spillover-water-sheet')?.position.x).toBeCloseTo(-0.625)
    const leftWall = geometry.getObjectByName('pool-spillover-channel-wall-left') as unknown as {
      geometry: { parameters: { height: number } }
      position: { y: number; z: number }
    }
    expect(leftWall.position.y + leftWall.geometry.parameters.height / 2).toBeGreaterThanOrEqual(0.03)
    const rightWall = geometry.getObjectByName('pool-spillover-channel-wall-right') as unknown as {
      position: { z: number }
    }
    const leftBorder = geometry.getObjectByName('pool-spillover-channel-outer-border-left') as unknown as {
      geometry: { parameters: { depth: number } }
      position: { z: number }
    }
    const rightBorder = geometry.getObjectByName('pool-spillover-channel-outer-border-right') as unknown as {
      geometry: { parameters: { depth: number } }
      position: { z: number }
    }
    // The outer face of each rectangular rail reaches the spillover opening
    // edge (width / 2), while the pool walls themselves remain inset.
    expect(leftBorder.position.z - leftBorder.geometry.parameters.depth / 2).toBeCloseTo(-1.2)
    expect(rightBorder.position.z + rightBorder.geometry.parameters.depth / 2).toBeCloseTo(1.2)
    expect(leftWall.position.z).toBeCloseTo(leftBorder.position.z)
    expect(rightWall.position.z).toBeCloseTo(rightBorder.position.z)
    const invalidMeshes: string[] = []
    geometry.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      if ((mesh.geometry.getAttribute('position')?.count ?? 0) === 0 || !mesh.geometry.getAttribute('uv')) {
        invalidMeshes.push(mesh.name || mesh.geometry.type)
      }
    })
    expect(invalidMeshes).toEqual([])
    disposeGeometry(geometry)
  })

  test('uses only the water sheet when pools touch edge to edge', () => {
    const geometry = buildPoolSpilloverGeometry(PoolSpilloverNode.parse({
      sourcePoolId: 'pool-upper',
      targetPoolId: 'pool-lower',
      connectionMode: 'channel',
      length: 0.1,
      width: 2.4,
      dropHeight: 0.6,
    }))

    expect(geometry.children.map((child) => child.name)).toEqual(['pool-spillover-water-sheet'])
    expect(geometry.userData.waterEffects).toHaveLength(1)
    disposeGeometry(geometry)
  })

  test('keeps channel geometry when intersection metadata is present', () => {
    const geometry = buildPoolSpilloverGeometry(PoolSpilloverNode.parse({
      sourcePoolId: 'pool-upper',
      targetPoolId: 'pool-lower',
      connectionMode: 'channel',
      intersection: [[[0, -1], [1, -1], [1, 1], [0, 1]]],
      connectionPath: [[0, 0], [1, 0]],
      length: 1,
      width: 2,
      dropHeight: 0.02,
    }))

    expect(geometry.children.map((child) => child.name)).toEqual([
      'pool-spillover-crest',
      'pool-spillover-channel-bed',
      'pool-spillover-channel-wall-left',
      'pool-spillover-channel-wall-right',
      'pool-spillover-channel-outer-border-left',
      'pool-spillover-channel-outer-border-right',
      'pool-spillover-water-sheet',
    ])
    disposeGeometry(geometry)
  })

  test('uses the constrained effective width without losing the desired width', () => {
    const node = PoolSpilloverNode.parse({
      sourcePoolId: 'pool-upper',
      targetPoolId: 'pool-lower',
      width: 3,
      effectiveWidth: 1.25,
      dropHeight: 0.5,
    })
    const geometry = buildPoolSpilloverGeometry(node)
    const sheet = geometry.getObjectByName('pool-spillover-water-sheet') as Mesh
    sheet.geometry.computeBoundingBox()
    expect(node.width).toBe(3)
    expect(sheet.geometry.boundingBox!.max.x - sheet.geometry.boundingBox!.min.x).toBeCloseTo(1.25)
    disposeGeometry(geometry)
  })

  test('builds a bedless direct sheet across a separated gap', () => {
    const geometry = buildPoolSpilloverGeometry(PoolSpilloverNode.parse({
      position: [2.5, 1, 0],
      sourcePoolId: 'pool-upper',
      targetPoolId: 'pool-lower',
      connectionMode: 'direct',
      connectionPath: [[2, 0], [3, 0]],
      length: 1,
      width: 1.5,
      dropHeight: 0.75,
    }))
    const sheet = geometry.getObjectByName('pool-spillover-water-sheet') as Mesh

    expect(geometry.getObjectByName('pool-spillover-channel-bed')).toBeUndefined()
    expect(sheet.geometry.type).toBe('BufferGeometry')
    expect(sheet.geometry.getAttribute('position').count).toBeGreaterThan(100)
    expect(sheet.geometry.getAttribute('uv').count).toBe(sheet.geometry.getAttribute('position').count)
    const invalidMeshes: string[] = []
    geometry.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      if ((mesh.geometry.getAttribute('position')?.count ?? 0) === 0 || !mesh.geometry.getAttribute('uv')) {
        invalidMeshes.push(mesh.name || mesh.geometry.type)
      }
    })
    expect(invalidMeshes).toEqual([])
    disposeGeometry(geometry)
  })

  test('keeps asymmetric endpoints at their lateral path offset', () => {
    const geometry = buildPoolSpilloverGeometry(PoolSpilloverNode.parse({
      position: [0, 1, 0],
      sourcePoolId: 'pool-upper',
      targetPoolId: 'pool-lower',
      connectionMode: 'overlap',
      connectionPath: [[1, 2], [-1, 2]],
      width: 1,
      dropHeight: 0.5,
    }))

    expect(geometry.getObjectByName('pool-spillover-crest')?.position.z).toBeCloseTo(2)
    expect(geometry.getObjectByName('pool-spillover-water-sheet')?.position.z).toBeCloseTo(2)
    disposeGeometry(geometry)
  })
})


describe('spillover water appearance and flow', () => {
  test('uses the source pool color on the continuous flowing-water material', () => {
    const geometry = buildPoolSpilloverGeometry(PoolSpilloverNode.parse({ sourcePoolId: 'pool_upper', targetPoolId: 'pool_lower', connectionMode: 'channel' }), {
      waterPreset: 'tropical-lagoon', shallowWaterColor: '#338877', deepWaterColor: '#114455',
    })
    const sheet = geometry.getObjectByName('pool-spillover-water-sheet') as Mesh
    expect(geometry.getObjectByName('pool-spillover-channel-water')).toBeUndefined()
    expect((sheet.material as MeshBasicNodeMaterial).color.equals(new Color('#338877'))).toBe(true)
    disposeGeometry(geometry)
  })

  test.each([-1, 1] as const)('uses a continuous curved sheet clear of the bed with source side %s', (sourceSide) => {
    const node = PoolSpilloverNode.parse({ sourcePoolId: 'pool_upper', targetPoolId: 'pool_lower', connectionMode: 'channel', sourceSide, dropHeight: 0.6 })
    const geometry = buildPoolSpilloverGeometry(node)
    const sheet = geometry.getObjectByName('pool-spillover-water-sheet') as Mesh
    const positions = sheet.geometry.getAttribute('position')
    const uv = sheet.geometry.getAttribute('uv')
    const normals = sheet.geometry.getAttribute('normal')
    let horizontal = 0
    let curved = 0
    for (let index = 0; index < positions.count; index += 1) {
      expect(Number.isFinite(positions.getY(index))).toBe(true)
      if (positions.getZ(index) < 0) {
        horizontal++
        expect(positions.getY(index) + sheet.position.y).toBeGreaterThan(0.015)
      }
      if (normals.getY(index) > 0.1 && normals.getY(index) < 0.9) curved++
    }
    expect(horizontal).toBeGreaterThan(0)
    expect(curved).toBeGreaterThan(0)
    expect(uv.getY(0)).toBe(0)
    expect(uv.getY(positions.count - 1)).toBe(1)
    expect(positions.getY(positions.count - 1) + sheet.position.y).toBeLessThan(-node.dropHeight)
    expect(sheet.rotation.y).toBe(-sourceSide * Math.PI / 2)
    expect(geometry.getObjectByName('pool-spillover-channel-water')).toBeUndefined()
    disposeGeometry(geometry)
  })
})
