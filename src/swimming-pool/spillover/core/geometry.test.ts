import { describe, expect, test } from 'bun:test'
import type { Mesh } from 'three'
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
  test('builds a crest, falling sheet, and receiving impact', () => {
    const geometry = buildPoolSpilloverGeometry(PoolSpilloverNode.parse({
      sourcePoolId: 'pool-upper',
      targetPoolId: 'pool-lower',
      width: 2.4,
      dropHeight: 0.6,
    }))
    expect(geometry.children.map((child) => child.name)).toEqual([
      'pool-spillover-crest',
      'pool-spillover-water-sheet',
      'pool-spillover-impact',
    ])
    expect(geometry.userData.waterEffects).toHaveLength(2)
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
    expect(geometry.getObjectByName('pool-spillover-water-sheet')?.position.x).toBeCloseTo(-0.25)
    const impact = geometry.getObjectByName('pool-spillover-impact') as unknown as {
      geometry: { type: string; parameters: { width: number; height: number } }
      position: { x: number }
    }
    expect(impact?.position.x).toBeLessThan(-0.25)
    expect(impact.geometry.type).toBe('PlaneGeometry')
    expect(impact.geometry.parameters.height).toBeGreaterThan(impact.geometry.parameters.width * 10)
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
      'pool-spillover-channel-water',
      'pool-spillover-channel-wall-left',
      'pool-spillover-channel-wall-right',
      'pool-spillover-water-sheet',
      'pool-spillover-impact',
    ])
    expect(geometry.getObjectByName('pool-spillover-crest')?.position.x).toBeCloseTo(0.585)
    expect(geometry.getObjectByName('pool-spillover-water-sheet')?.position.x).toBeCloseTo(-0.625)
    expect(geometry.getObjectByName('pool-spillover-impact')?.position.x).toBeLessThan(-0.625)
    const leftWall = geometry.getObjectByName('pool-spillover-channel-wall-left') as unknown as {
      geometry: { parameters: { height: number } }
      position: { y: number }
    }
    expect(leftWall.position.y + leftWall.geometry.parameters.height / 2).toBeGreaterThanOrEqual(0.03)
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

  test('uses the constrained effective width without losing the desired width', () => {
    const node = PoolSpilloverNode.parse({
      sourcePoolId: 'pool-upper',
      targetPoolId: 'pool-lower',
      width: 3,
      effectiveWidth: 1.25,
      dropHeight: 0.5,
    })
    const geometry = buildPoolSpilloverGeometry(node)
    const sheet = geometry.getObjectByName('pool-spillover-water-sheet') as unknown as {
      geometry: { parameters: { width: number } }
    }

    expect(node.width).toBe(3)
    expect(sheet.geometry.parameters.width).toBe(1.25)
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
    expect(sheet.geometry.getAttribute('position').count).toBe(4)
    expect(sheet.geometry.getAttribute('uv').count).toBe(4)
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
    expect(geometry.getObjectByName('pool-spillover-impact')?.position.z).toBeCloseTo(2)
    disposeGeometry(geometry)
  })
})
