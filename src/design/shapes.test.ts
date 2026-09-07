import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_POOL_SHAPE_DIMENSIONS,
  POOL_SHAPES,
  createPoolShapePolygon,
  getPoolPolygonDimensions,
  isDrawnPoolShape,
  isPoolPolygonPlaceable,
  sampleClosedPoolSpline,
} from './shapes'

describe('pool shapes', () => {
  test('creates every preset at its requested dimensions', () => {
    for (const shape of POOL_SHAPES) {
      const dimensions = DEFAULT_POOL_SHAPE_DIMENSIONS[shape]
      const polygon = createPoolShapePolygon(shape, dimensions.length, dimensions.width)
      const actual = getPoolPolygonDimensions(polygon)

      expect(polygon.length).toBeGreaterThanOrEqual(4)
      expect(isPoolPolygonPlaceable(polygon)).toBe(true)
      expect(actual.length).toBeCloseTo(dimensions.length, 5)
      expect(actual.width).toBeCloseTo(dimensions.width, 5)
    }
  })

  test('clamps invalid dimensions to the minimum usable size', () => {
    const dimensions = getPoolPolygonDimensions(createPoolShapePolygon('rectangle', -10, 0))
    expect(dimensions).toEqual({ length: 0.5, width: 0.5 })
  })

  test('identifies only editor-drawn shapes', () => {
    expect(POOL_SHAPES.filter(isDrawnPoolShape)).toEqual(['spline', 'custom'])
  })

  test('samples closed splines deterministically and handles degenerate inputs', () => {
    const anchors: Array<[number, number]> = [[-2, -1], [2, -1], [2, 1], [-2, 1]]
    const curved = sampleClosedPoolSpline(anchors, 4, 1)
    const straight = sampleClosedPoolSpline(anchors, 4, -1)

    expect(curved).toHaveLength(16)
    expect(curved).toEqual(sampleClosedPoolSpline(anchors, 4, 1))
    expect(straight[0]).toEqual(anchors[0])
    expect(sampleClosedPoolSpline(anchors.slice(0, 2))).toEqual(anchors.slice(0, 2))
  })
})
