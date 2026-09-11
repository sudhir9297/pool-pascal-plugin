import { describe, expect, test } from 'bun:test'
import {
  Box3,
  Color,
  MeshStandardMaterial,
  Matrix4,
  Quaternion,
  Vector3,
  type InstancedMesh,
  type Mesh,
  type MeshPhysicalMaterial,
  type Object3D,
} from 'three'
import { LOW_POLY_ROCK_PROFILES } from '../../../design/low-poly-rock'
import { buildWaterfallGeometry, getWaterfallImpactLocalPoint } from './geometry'
import { DEFAULT_POOL_WATERFALL, PoolWaterfallNode } from './schema'

function namedObjects(root: Object3D) {
  const result: Object3D[] = []
  root.traverse((object) => {
    if (object.name) result.push(object)
  })
  return result
}

function rockCount(root: Object3D) {
  return namedObjects(root)
    .filter((object) => object.name.startsWith('waterfall-rock-'))
    .reduce((sum, object) => sum + Number(object.userData.rockCount ?? 0), 0)
}

describe('waterfall geometry', () => {
  test('builds a dense, varied rock formation around matching receiving water', () => {
    const node = PoolWaterfallNode.parse(DEFAULT_POOL_WATERFALL)
    const geometry = buildWaterfallGeometry(node)
    const objects = namedObjects(geometry)
    const rocks = objects.filter((object) => object.name.startsWith('waterfall-rock-'))
    const bubbles = objects.filter((object) => object.name.startsWith('waterfall-bubble-cloud-')) as InstancedMesh[]
    const profiles = new Set(rocks.flatMap((rock) => rock.userData.rockProfiles ?? []))
    const receivingWater = objects.find((object) => object.name === 'waterfall-receiving-water')

    expect(rockCount(geometry)).toBe(33)
    expect(profiles).toEqual(new Set(LOW_POLY_ROCK_PROFILES))
    expect(receivingWater?.userData.waterPreset).toBe(node.waterPreset)
    expect(receivingWater?.userData.shallowWaterColor).toBe(node.shallowWaterColor)
    expect(receivingWater?.userData.deepWaterColor).toBe(node.deepWaterColor)
    expect(objects.some((object) => object.name === 'waterfall-natural-cavity')).toBe(true)
    expect(objects.some((object) => object.name === 'waterfall-natural-channel')).toBe(true)
    expect(objects.some((object) => object.name === 'waterfall-water-sheet')).toBe(true)
    expect(objects.some((object) => object.name === 'waterfall-flow-lines')).toBe(true)
    expect(bubbles).toHaveLength(3)
    expect(new Set(bubbles.map((bubble) => bubble.userData.bubbleFamily)))
      .toEqual(new Set(['foam', 'aeration', 'microstream']))
    expect(bubbles.reduce((sum, bubble) => sum + bubble.count, 0)).toBeGreaterThan(100)
    expect(bubbles.every((bubble) => bubble.instanceColor !== null)).toBe(true)
    expect(bubbles.every((bubble) => bubble.geometry.getAttribute('normal').count > 40)).toBe(true)
    expect(bubbles.every((bubble) => (bubble.material as MeshPhysicalMaterial).transmission > 0)).toBe(true)
    const foam = bubbles.find((bubble) => bubble.userData.bubbleFamily === 'foam')!
    expect((foam.material as MeshPhysicalMaterial).transmission).toBeGreaterThan(0.7)
    expect((foam.material as MeshPhysicalMaterial).opacity).toBeLessThan(0.4)
    expect(objects.some((object) => object.name === 'waterfall-impact-foam')).toBe(false)
    expect(objects.some((object) => object.name === 'waterfall-mist')).toBe(false)
    expect(objects.some((object) => object.name === 'waterfall-fountain-spray')).toBe(false)
    expect(objects.some((object) => object.name.startsWith('waterfall-fountain-stream-'))).toBe(false)

    const bounds = new Box3().setFromObject(geometry)
    expect(bounds.max.y).toBeLessThanOrEqual(node.height * 1.1)
    expect(bounds.min.x).toBeGreaterThan(-node.receivingPoolWidth * 0.75)
    expect(bounds.max.x).toBeLessThan(node.receivingPoolWidth * 0.75)
  })

  test('merges the rock formation while retaining full-width coverage', () => {
    const geometry = buildWaterfallGeometry(PoolWaterfallNode.parse({ receivingPoolEnabled: false }))
    const mound = namedObjects(geometry).find((object) => object.name === 'waterfall-rock-mound')!
    const bounds = new Box3().setFromObject(mound)

    expect(mound.userData.rockCount).toBe(25)
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(3.5)
  })

  test('adapts rock density to waterfall width while keeping layered coverage', () => {
    const narrow = buildWaterfallGeometry(PoolWaterfallNode.parse({
      width: 1.2,
      receivingPoolEnabled: false,
    }))
    const wide = buildWaterfallGeometry(PoolWaterfallNode.parse({
      width: 8,
      receivingPoolEnabled: false,
    }))
    expect(rockCount(narrow)).toBeLessThan(33)
    expect(rockCount(wide)).toBeGreaterThan(33)
  })

  test('shares rock materials and keeps mounted rock color editable', () => {
    const first = buildWaterfallGeometry(PoolWaterfallNode.parse({
      poolId: 'pool_host',
      poolRockSeed: 123,
      rockColor: '#7a351f',
      receivingPoolEnabled: false,
    }))
    const second = buildWaterfallGeometry(PoolWaterfallNode.parse({
      poolId: 'pool_host',
      poolRockSeed: 123,
      rockColor: '#1f517a',
      receivingPoolEnabled: false,
    }))
    const firstRocks = namedObjects(first).filter((object) => object.name.startsWith('waterfall-rock-')) as Mesh[]
    const secondRock = namedObjects(second).find((object) => object.name.startsWith('waterfall-rock-')) as Mesh
    expect(firstRocks).toHaveLength(1)
    for (const [rock, color] of [[firstRocks[0]!, '#7a351f'], [secondRock, '#1f517a']] as const) {
      expect(rock.geometry.getAttribute('color')).toBeUndefined()
      const materials = Array.isArray(rock.material) ? rock.material : [rock.material]
      for (const material of materials) {
        expect(material).toBeInstanceOf(MeshStandardMaterial)
        if (!(material instanceof MeshStandardMaterial)) throw new Error('Expected editable rock material')
        expect(material.vertexColors).toBe(false)
        expect(material.color.equals(new Color(color))).toBe(true)
      }
    }
  })

  test('keeps the receiving pool but removes active flow effects when flow is off', () => {
    const geometry = buildWaterfallGeometry(PoolWaterfallNode.parse({ showFlow: false }))
    const names = namedObjects(geometry).map((object) => object.name)
    expect(names).toContain('waterfall-receiving-water')
    expect(names).toContain('waterfall-natural-cavity')
    expect(names).not.toContain('waterfall-water-sheet')
    expect(names).not.toContain('waterfall-flow-lines')
    expect(names.some((name) => name.startsWith('waterfall-bubble-cloud-'))).toBe(false)
    expect(names).not.toContain('waterfall-impact-foam')
    expect(names).not.toContain('waterfall-mist')
    expect(names).not.toContain('waterfall-fountain-spray')
    expect(names.some((name) => name.startsWith('waterfall-fountain-stream-'))).toBe(false)
  })

  test('supports the modern and all rock-backed variants', () => {
    for (const waterfallType of ['modern', 'rock-cascade', 'spillover'] as const) {
      const geometry = buildWaterfallGeometry(PoolWaterfallNode.parse({ waterfallType }))
      const names = namedObjects(geometry).map((object) => object.name)
      expect(names).toContain('waterfall-receiving-water')
      expect(names).toContain('waterfall-water-sheet')
      expect(names.some((name) => name.startsWith('waterfall-bubble-cloud-'))).toBe(true)
      if (waterfallType === 'modern') {
        expect(names).toContain('waterfall-modern-wall')
        expect(names).toContain('waterfall-spillway-box')
        expect(names).toContain('waterfall-spillway-opening')
      } else if (waterfallType === 'spillover') {
        expect(rockCount(geometry)).toBeLessThan(33)
        expect(names).toContain('waterfall-spillover-weir')
        expect(names).not.toContain('waterfall-natural-cavity')
      } else {
        expect(rockCount(geometry)).toBe(33)
        expect(names).toContain('waterfall-natural-cavity')
      }
    }
  })

  test('uses one continuous surface for the horizontal run, curved lip, and vertical fall', () => {
    const geometry = buildWaterfallGeometry(PoolWaterfallNode.parse({ waterfallType: 'modern' }))
    const sheet = namedObjects(geometry)
      .find((object) => object.name === 'waterfall-water-sheet') as Mesh
    const normals = sheet.geometry.getAttribute('normal')
    const uvs = sheet.geometry.getAttribute('uv')
    let hasHorizontal = false
    let hasCurve = false
    let hasVertical = false

    for (let index = 0; index < normals.count; index += 1) {
      const y = normals.getY(index)
      const z = normals.getZ(index)
      if (y > 0.9) hasHorizontal = true
      if (y > 0.2 && y < 0.85 && z > 0.2) hasCurve = true
      if (z > 0.9) hasVertical = true
    }

    expect(hasHorizontal).toBe(true)
    expect(hasCurve).toBe(true)
    expect(hasVertical).toBe(true)
    expect(uvs.getY(0)).toBeCloseTo(0)
    expect(uvs.getY(uvs.count - 1)).toBeCloseTo(1)
  })

  test('carries a mounted edge bend through the falling sheet', () => {
    const geometry = buildWaterfallGeometry(PoolWaterfallNode.parse({
      poolId: 'pool_host',
      receivingPoolEnabled: false,
      edgeCurve: [[-2, 0], [0, 0], [2, 0.8]],
    }))
    const sheet = namedObjects(geometry).find((object) => object.name === 'waterfall-water-sheet') as Mesh
    const positions = sheet.geometry.getAttribute('position')
    const first = positions.getZ(0)
    const last = positions.getZ(positions.count - 1)
    expect(last - first).toBeGreaterThan(0.5)
  })

  test('models the source as a recessed spillway housing around the water channel', () => {
    const geometry = buildWaterfallGeometry(PoolWaterfallNode.parse({ waterfallType: 'modern' }))
    const objects = namedObjects(geometry)
    const opening = objects.find((object) => object.name === 'waterfall-spillway-opening')!
    const canopy = objects.find((object) => object.name === 'waterfall-spillway-canopy')!
    const channel = objects.find((object) => object.name === 'waterfall-spillway-channel')!
    const sill = objects.find((object) => object.name === 'waterfall-spillway-sill')!
    const left = objects.find((object) => object.name === 'waterfall-spillway-left') as Mesh
    const right = objects.find((object) => object.name === 'waterfall-spillway-right') as Mesh

    expect(canopy.position.y).toBeGreaterThan(opening.position.y)
    expect(opening.position.z).toBeLessThan(channel.position.z)
    expect(sill.position.z).toBeGreaterThan(channel.position.z)
    expect(left.position.x).toBeLessThan(0)
    expect(right.position.x).toBeGreaterThan(0)
    expect(left.castShadow).toBe(true)
    expect(right.receiveShadow).toBe(true)
  })

  test('passes each water preset and its colors to the falling sheet and receiving water', () => {
    for (const waterPreset of ['crystal-clear', 'vivid-aqua', 'tropical-lagoon'] as const) {
      const node = PoolWaterfallNode.parse({
        waterPreset,
        shallowWaterColor: '#12abcd',
        deepWaterColor: '#034567',
      })
      const geometry = buildWaterfallGeometry(node)
      const objects = namedObjects(geometry)
      const sheet = objects.find((object) => object.name === 'waterfall-water-sheet')!
      const receivingWater = objects.find((object) => object.name === 'waterfall-receiving-water')!

      for (const water of [sheet, receivingWater]) {
        expect(water.userData.waterPreset).toBe(waterPreset)
        expect(water.userData.shallowWaterColor).toBe('#12abcd')
        expect(water.userData.deepWaterColor).toBe('#034567')
      }
    }
  })

  test('can disable the receiving pool without creating a lower fountain', () => {
    const geometry = buildWaterfallGeometry(PoolWaterfallNode.parse({
      receivingPoolEnabled: false,
    }))
    const names = namedObjects(geometry).map((object) => object.name)
    expect(names).not.toContain('waterfall-receiving-water')
    expect(names).not.toContain('waterfall-receiving-bed')
    expect(names).not.toContain('waterfall-fountain-spray')
    expect(names.some((name) => name.startsWith('waterfall-fountain-stream-'))).toBe(false)
    expect(names).toContain('waterfall-water-sheet')
  })

  test('uses the host pool waterline and omits standalone pond rocks when mounted', () => {
    const node = PoolWaterfallNode.parse({
      poolId: 'pool_host',
      receivingPoolEnabled: false,
      targetWaterOffset: -0.18,
      edgeCurve: [[-2.2, 0.32], [-1.1, 0.08], [0, 0], [1.1, 0.08], [2.2, 0.32]],
    })
    const geometry = buildWaterfallGeometry(node)
    const objects = namedObjects(geometry)
    const rocks = objects.filter((object) => object.name.startsWith('waterfall-rock-'))
    expect(rockCount(geometry)).toBe(25)
    expect(objects.some((object) => object.name === 'waterfall-receiving-water')).toBe(false)
    expect(objects.some((object) => object.name === 'waterfall-impact-foam')).toBe(false)
    expect(new Box3().setFromObject(rocks[0]!).max.z).toBeGreaterThan(0.12)

    const sheet = objects.find((object) => object.name === 'waterfall-water-sheet') as Mesh
    sheet.geometry.computeBoundingBox()
    const sheetBottom = sheet.position.y + sheet.geometry.boundingBox!.min.y
    expect(sheetBottom).toBeLessThan(node.targetWaterOffset)
    expect(sheetBottom).toBeGreaterThan(node.targetWaterOffset - 0.08)
    const bubbles = objects.filter((object) => object.name.startsWith('waterfall-bubble-cloud-')) as InstancedMesh[]
    for (const bubbleLayer of bubbles) bubbleLayer.userData.waterfallEffect.update(0.1)
    const positions: Vector3[] = []
    const scales: Vector3[] = []
    const matrix = new Matrix4()
    const quaternion = new Quaternion()
    for (const bubbleLayer of bubbles) {
      for (let index = 0; index < bubbleLayer.count; index += 1) {
        const position = new Vector3()
        const scale = new Vector3()
        bubbleLayer.getMatrixAt(index, matrix)
        matrix.decompose(position, quaternion, scale)
        positions.push(position)
        scales.push(scale)
      }
    }
    expect(positions.length).toBeGreaterThan(100)
    expect(new Set(scales.map((scale) => scale.x.toFixed(3))).size).toBeGreaterThan(20)
    const foamLayer = bubbles.find((bubble) => bubble.name === 'waterfall-bubble-cloud-foam')!
    expect(foamLayer.count).toBeGreaterThanOrEqual(9)
    expect(foamLayer.count).toBeLessThanOrEqual(16)
    const foamScales: Vector3[] = []
    for (let index = 0; index < foamLayer.count; index += 1) {
      const foamPosition = new Vector3()
      const foamScale = new Vector3()
      foamLayer.getMatrixAt(index, matrix)
      matrix.decompose(foamPosition, quaternion, foamScale)
      foamScales.push(foamScale)
    }
    expect(foamScales.filter((scale) => {
      const smallest = Math.min(scale.x, scale.y, scale.z)
      const largest = Math.max(scale.x, scale.y, scale.z)
      return largest / Math.max(0.001, smallest) < 1.5
    }).length).toBeGreaterThan(foamScales.length * 0.8)
    expect(Math.max(...positions.map((position) => position.x))
      - Math.min(...positions.map((position) => position.x)))
      .toBeGreaterThan(node.width * 0.2)
    const tops = positions.map((position, index) => position.y + scales[index]!.y)
    expect(tops.filter((top) => top > node.targetWaterOffset).length)
      .toBeGreaterThan(positions.length * 0.9)
    expect(positions.every((position, index) => {
      const top = position.y + scales[index]!.y
      const bottom = position.y - scales[index]!.y
      return top < node.targetWaterOffset + 0.18
        && bottom > node.targetWaterOffset - 0.1
    })).toBe(true)
  })

  test('samples waterfall impacts across the real curved contact edge', () => {
    const node = PoolWaterfallNode.parse({
      width: 4,
      waterfallType: 'rock-cascade',
      edgeCurve: [[-1, 0.34], [0, 0], [1, 0.22]],
    })
    const left = getWaterfallImpactLocalPoint(node, -1)
    const center = getWaterfallImpactLocalPoint(node, 0)
    const right = getWaterfallImpactLocalPoint(node, 1)

    expect(left[0]).toBeCloseTo(-0.6)
    expect(center[0]).toBe(0)
    expect(right[0]).toBeCloseTo(0.6)
    expect(left[1]).toBeGreaterThan(center[1])
    expect(right[1]).toBeGreaterThan(center[1])
    expect(left[1]).not.toBeCloseTo(right[1])
  })

  test('uses the full modern spillway width for its impact band', () => {
    const node = PoolWaterfallNode.parse({ width: 1.2, waterfallType: 'modern' })
    const left = getWaterfallImpactLocalPoint(node, -1)
    const right = getWaterfallImpactLocalPoint(node, 1)

    expect(right[0] - left[0]).toBeCloseTo(1.12)
  })

  test('renders waterfalls saved before pool-boundary fields were introduced', () => {
    const legacyNode = {
      ...PoolWaterfallNode.parse({ receivingPoolEnabled: false }),
      edgeCurve: undefined,
      targetWaterOffset: undefined,
    } as unknown as PoolWaterfallNode

    const geometry = buildWaterfallGeometry(legacyNode)
    const objects = namedObjects(geometry)
    const waterSheet = objects.find((object) => object.name === 'waterfall-water-sheet')
    expect(rockCount(geometry)).toBe(33)
    expect(waterSheet).toBeDefined()
    expect(Number.isFinite(waterSheet?.position.y)).toBe(true)
    expect(objects.some((object) => object.name === 'waterfall-impact-foam')).toBe(false)
  })

  test('restores omitted numeric defaults before building legacy receiving-pool rocks', () => {
    const legacyNode = {
      ...PoolWaterfallNode.parse({ receivingPoolEnabled: true }),
      receivingPoolWidth: undefined,
      receivingPoolDepth: undefined,
      height: undefined,
    } as unknown as PoolWaterfallNode

    const geometry = buildWaterfallGeometry(legacyNode)
    const meshes: Object3D[] = []
    geometry.traverse((object) => meshes.push(object))
    const rock = namedObjects(geometry).find((object) => object.name === 'waterfall-rock-pond-edge')
    const bounds = new Box3().setFromObject(geometry)

    expect(rock).toBeDefined()
    expect(bounds.min.toArray().every(Number.isFinite)).toBe(true)
    expect(bounds.max.toArray().every(Number.isFinite)).toBe(true)
    expect(meshes.every((object) => object.position.toArray().every(Number.isFinite))).toBe(true)
  })
})
