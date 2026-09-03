import { describe, expect, test } from 'bun:test'
import { Box3, type Mesh, type Object3D } from 'three'
import { LOW_POLY_ROCK_PROFILES } from '../../../design/low-poly-rock'
import { DEFAULT_POOL_WATERFALL } from './definition'
import { buildWaterfallGeometry } from './geometry'
import { PoolWaterfallNode } from './schema'

function namedObjects(root: Object3D) {
  const result: Object3D[] = []
  root.traverse((object) => {
    if (object.name) result.push(object)
  })
  return result
}

describe('waterfall geometry', () => {
  test('builds a dense, varied rock formation around matching receiving water', () => {
    const node = PoolWaterfallNode.parse(DEFAULT_POOL_WATERFALL)
    const geometry = buildWaterfallGeometry(node)
    const objects = namedObjects(geometry)
    const rocks = objects.filter((object) => object.name.startsWith('waterfall-rock-'))
    const profiles = new Set(rocks.map((rock) => rock.userData.rockProfile))
    const receivingWater = objects.find((object) => object.name === 'waterfall-receiving-water')

    expect(rocks).toHaveLength(33)
    expect(profiles).toEqual(new Set(LOW_POLY_ROCK_PROFILES))
    expect(receivingWater?.userData.waterPreset).toBe(node.waterPreset)
    expect(receivingWater?.userData.shallowWaterColor).toBe(node.shallowWaterColor)
    expect(receivingWater?.userData.deepWaterColor).toBe(node.deepWaterColor)
    expect(objects.some((object) => object.name === 'waterfall-natural-cavity')).toBe(true)
    expect(objects.some((object) => object.name === 'waterfall-water-sheet')).toBe(true)
    expect(objects.some((object) => object.name === 'waterfall-impact-foam')).toBe(true)
    expect(objects.some((object) => object.name === 'waterfall-mist')).toBe(true)
    expect(objects.some((object) => object.name === 'waterfall-fountain-spray')).toBe(false)
    expect(objects.some((object) => object.name.startsWith('waterfall-fountain-stream-'))).toBe(false)

    const bounds = new Box3().setFromObject(geometry)
    expect(bounds.max.y).toBeLessThanOrEqual(node.height * 1.1)
    expect(bounds.min.x).toBeGreaterThan(-node.receivingPoolWidth * 0.75)
    expect(bounds.max.x).toBeLessThan(node.receivingPoolWidth * 0.75)
  })

  test('packs the base rocks into one continuous attached row', () => {
    const geometry = buildWaterfallGeometry(PoolWaterfallNode.parse({ receivingPoolEnabled: false }))
    const baseRocks = namedObjects(geometry)
      .filter((object) => /^waterfall-rock-[0-5]-/.test(object.name))
      .sort((first, second) => first.position.x - second.position.x)
    const boxes = baseRocks.map((rock) => new Box3().setFromObject(rock))

    expect(baseRocks).toHaveLength(6)
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index - 1]!.max.x).toBeGreaterThanOrEqual(boxes[index]!.min.x)
    }
  })

  test('keeps the receiving pool but removes active flow effects when flow is off', () => {
    const geometry = buildWaterfallGeometry(PoolWaterfallNode.parse({ showFlow: false }))
    const names = namedObjects(geometry).map((object) => object.name)
    expect(names).toContain('waterfall-receiving-water')
    expect(names).toContain('waterfall-natural-cavity')
    expect(names).not.toContain('waterfall-water-sheet')
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
      if (waterfallType === 'modern') {
        expect(names).toContain('waterfall-modern-wall')
        expect(names).toContain('waterfall-spillway-box')
        expect(names).toContain('waterfall-spillway-opening')
      } else {
        expect(names.filter((name) => name.startsWith('waterfall-rock-'))).toHaveLength(33)
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
      fountainEnabled: false,
      targetWaterOffset: -0.18,
      edgeCurve: [[-2.2, 0.32], [-1.1, 0.08], [0, 0], [1.1, 0.08], [2.2, 0.32]],
    })
    const geometry = buildWaterfallGeometry(node)
    const objects = namedObjects(geometry)
    const rocks = objects.filter((object) => object.name.startsWith('waterfall-rock-'))
    expect(rocks).toHaveLength(25)
    expect(objects.some((object) => object.name === 'waterfall-receiving-water')).toBe(false)
    expect(objects.some((object) => object.name === 'waterfall-impact-foam')).toBe(true)
    expect(rocks.some((rock) => rock.position.z > 0.12)).toBe(true)
  })

  test('renders waterfalls saved before pool-boundary fields were introduced', () => {
    const legacyNode = {
      ...PoolWaterfallNode.parse({ receivingPoolEnabled: false, fountainEnabled: false }),
      edgeCurve: undefined,
      targetWaterOffset: undefined,
    } as unknown as PoolWaterfallNode

    const geometry = buildWaterfallGeometry(legacyNode)
    const objects = namedObjects(geometry)
    const waterSheet = objects.find((object) => object.name === 'waterfall-water-sheet')
    expect(objects.filter((object) => object.name.startsWith('waterfall-rock-'))).toHaveLength(33)
    expect(waterSheet).toBeDefined()
    expect(Number.isFinite(waterSheet?.position.y)).toBe(true)
    expect(objects.some((object) => object.name === 'waterfall-impact-foam')).toBe(true)
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
    const rock = namedObjects(geometry).find((object) => object.name.startsWith('waterfall-rock-25-'))
    const bounds = new Box3().setFromObject(geometry)

    expect(rock).toBeDefined()
    expect(bounds.min.toArray().every(Number.isFinite)).toBe(true)
    expect(bounds.max.toArray().every(Number.isFinite)).toBe(true)
    expect(meshes.every((object) => object.position.toArray().every(Number.isFinite))).toBe(true)
  })
})
