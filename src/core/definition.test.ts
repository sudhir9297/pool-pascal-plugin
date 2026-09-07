import { describe, expect, test } from 'bun:test'
import type { GeometryContext } from '@pascal-app/core'
import { poolFloorplan } from './definition'
import { PoolNode } from './schema'

describe('pool floorplan', () => {
  test('renders a clearly selected outline in 2D', () => {
    const pool = PoolNode.parse({ id: 'pool_a', parentId: 'level_a' })
    const normal = poolFloorplan(pool)
    const selected = poolFloorplan(pool, {
      viewState: {
        selected: true,
        highlighted: false,
        hovered: false,
        moving: false,
        unit: 'metric',
        palette: { selectedStroke: '#ff5500' } as never,
      },
    } as unknown as GeometryContext)

    expect(normal.kind).toBe('path')
    expect(selected.kind).toBe('path')
    if (normal.kind !== 'path' || selected.kind !== 'path') return
    expect(selected.stroke).toBe('#ff5500')
    expect(selected.strokeWidth).toBeGreaterThan(normal.strokeWidth ?? 0)
    expect(selected.fillOpacity).toBeGreaterThan(normal.fillOpacity ?? 0)
  })
})
