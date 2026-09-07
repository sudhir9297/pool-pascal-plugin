import { describe, expect, test } from 'bun:test'
import { advanceFreehandPoolStroke, buildFreehandPoolOutline } from './freehand-outline'
import { getPoolPolygonDimensions, isPoolPolygonPlaceable } from './shapes'

describe('freehand pool outlines', () => {
  test('ignores pointer samples that are too close together', () => {
    const points: Array<[number, number]> = [[0, 0]]
    const result = advanceFreehandPoolStroke(points, [0.01, 0], {
      closeDistance: 0.1,
      sampleDistance: 0.1,
    })

    expect(result.points).toEqual(points)
    expect(result.points).not.toBe(points)
    expect(result.closed).toBeNull()
  })

  test('closes near the first point and creates a usable smooth polygon', () => {
    const raw: Array<[number, number]> = [
      [0, 0], [4, 0], [4, 3], [0, 3], [0.03, 0.02],
    ]
    const outline = buildFreehandPoolOutline(raw, {
      closeDistance: 0.1,
      simplifyTolerance: 0.02,
      segmentsPerSpan: 6,
    })

    expect(outline?.anchors).toHaveLength(4)
    expect(outline?.polygon).toHaveLength(24)
    expect(isPoolPolygonPlaceable(outline!.polygon)).toBe(true)
    expect(getPoolPolygonDimensions(outline!.polygon).length).toBeGreaterThan(3.9)
  })

  test('uses a crossing of the earlier stroke as a valid closure', () => {
    const points: Array<[number, number]> = [[0, 0], [4, 0], [4, 4], [0, 4]]
    const result = advanceFreehandPoolStroke(points, [2, -1], {
      closeDistance: 0.1,
      sampleDistance: 0.1,
    })

    expect(result.closed?.[0]?.[0]).toBeCloseTo(1.6)
    expect(result.closed?.[0]?.[1]).toBeCloseTo(0)
    expect(result.closed).toHaveLength(4)
  })

  test('rejects open and self-intersecting outlines', () => {
    expect(buildFreehandPoolOutline([[0, 0], [4, 0], [4, 4]], {
      closeDistance: 0.1,
      simplifyTolerance: 0.02,
    })).toBeNull()
    expect(buildFreehandPoolOutline([
      [0, 0], [4, 4], [0, 4], [4, 0], [0.01, 0.01],
    ], {
      closeDistance: 0.1,
      simplifyTolerance: 0,
    })).toBeNull()
  })
})
