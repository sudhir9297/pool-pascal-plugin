import { expect, test } from 'bun:test'
import type { LinearResizeHandle } from '@pascal-app/core'
import { Euler, Vector3 } from 'three'
import { poolDefinition } from './definition'
import { PoolNode, resolvePoolPolygon } from './schema'
import { createPoolShapePolygon } from '../design/shapes'

for (const shape of ['rectangle', 'custom'] as const) {
for (const axis of ['x', 'z'] as const) {
  for (const angle of [0, Math.PI / 2, 0.7]) {
    for (const delta of [2, -1]) {
      test(`${shape} ${axis} resize ${delta} keeps opposite edge fixed at rotation ${angle}`, () => {
        const node = PoolNode.parse({ shape, polygon: shape === 'custom' ? [[1, 2], [9, 2], [9, 6], [1, 6]] : createPoolShapePolygon(shape, 8, 4), length: 8, width: 4, position: [3, 1, 7], rotation: [0, angle, 0] })
        const handles = typeof poolDefinition.handles === 'function' ? poolDefinition.handles(node) : poolDefinition.handles!
        const handle = handles.find(handle => handle.kind === 'linear-resize' && handle.axis === axis)!
        if (handle.kind !== 'linear-resize') throw new Error('Expected linear resize')
        const edge = (pool: PoolNode) => {
          const points = resolvePoolPolygon(pool)
          const min = Math.min(...points.map(point => point[axis === 'x' ? 0 : 1]))
          return new Vector3(axis === 'x' ? min : 0, 0, axis === 'z' ? min : 0)
            .applyEuler(new Euler(...pool.rotation)).add(new Vector3(...pool.position))
        }
        const patch = handle.apply(node, handle.currentValue(node) + delta, {} as never)
        expect(edge({ ...node, ...patch }).distanceTo(edge(node))).toBeLessThan(1e-8)
        expect(handle.anchor).toBe('min')
      })
    }
  }
}
}

test('circle pools expose one centered diameter handle that keeps the shape circular', () => {
  const node = PoolNode.parse({ shape: 'circle', length: 6, width: 6 })
  const handles = typeof poolDefinition.handles === 'function' ? poolDefinition.handles(node) : poolDefinition.handles!
  const diameter = handles.find(handle => handle.kind === 'radial-resize')
  expect(diameter?.kind).toBe('radial-resize')
  if (diameter?.kind !== 'radial-resize') return
  const patch = diameter.apply(node, 9, {} as never)
  expect(patch.length).toBe(9)
  expect(patch.width).toBe(9)
  expect(patch.polygon).toHaveLength(32)
  expect(new Set((patch.polygon ?? []).map(([x, z]) => Math.round(Math.hypot(x, z) * 1000))).size).toBe(1)
})

test('pool exposes rotation and independent shallow/deep depth handles', () => {
  const node = PoolNode.parse({ floorProfile: 'shallow-to-deep', shallowDepth: 1, deepDepth: 2 })
  const handles = typeof poolDefinition.handles === 'function' ? poolDefinition.handles(node) : poolDefinition.handles!
  const rotate = handles.find(handle => handle.kind === 'arc-resize')
  const depthHandles = handles.filter(handle => handle.kind === 'linear-resize' && handle.axis === 'y')
  expect(rotate?.kind).toBe('arc-resize')
  expect(depthHandles).toHaveLength(2)
  if (rotate?.kind === 'arc-resize') {
    expect(rotate.continuous).not.toBe(true)
    expect('angleStep' in rotate).toBe(false)
    expect(rotate.apply(node, Math.PI / 2, {} as never).rotation?.[1]).toBeCloseTo(-Math.PI / 2)
  }
  const shallow = depthHandles.find(handle => handle.kind === 'linear-resize' && handle.currentValue(node) === 1)
  expect(shallow?.kind).toBe('linear-resize')
  if (shallow?.kind === 'linear-resize') {
    expect(shallow.apply(node, 1.5, {} as never).shallowDepth).toBe(1.5)
  }
})

test('bench handles stay on the pool-facing side for every bench wall', () => {
  for (const benchWall of ['min-x', 'max-x', 'min-z', 'max-z'] as const) {
    const node = PoolNode.parse({ benchEnabled: true, benchWall, benchLength: 3, benchWidth: 0.5 })
    const handles = typeof poolDefinition.handles === 'function' ? poolDefinition.handles(node) : poolDefinition.handles!
    const benchHandles = handles.filter((handle): handle is LinearResizeHandle<PoolNode> => handle.kind === 'linear-resize' && (
      handle.currentValue(node) === node.benchLength || handle.currentValue(node) === node.benchWidth
    ))
    expect(benchHandles).toHaveLength(2)

    for (const handle of benchHandles) {
      const position = handle.placement?.position(node, {} as never)
      expect(position).toBeDefined()
      if (!position) continue
      expect(position[1]).toBeCloseTo(-node.benchWaterDepth)
      if (benchWall === 'min-x') expect(position[0]).toBeGreaterThan(-4)
      if (benchWall === 'max-x') expect(position[0]).toBeLessThan(4)
      if (benchWall === 'min-z') expect(position[2]).toBeGreaterThan(-2)
      if (benchWall === 'max-z') expect(position[2]).toBeLessThan(2)
    }
  }
})
