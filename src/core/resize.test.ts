import { expect, test } from 'bun:test'
import { Euler, Vector3 } from 'three'
import { poolDefinition } from './definition'
import { PoolNode, resolvePoolPolygon } from './schema'
import { createPoolShapePolygon } from '../design/shapes'

for (const shape of ['rectangle', 'circle', 'custom'] as const) {
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
