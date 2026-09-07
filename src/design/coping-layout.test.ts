import { describe, expect, test } from 'bun:test'
import { layoutNaturalCopingStones } from './coping-layout'

describe('rock coping layout', () => {
  test('creates one dedicated corner piece for every polygon vertex', () => {
    const points: [number, number][] = [
      [0, 0],
      [10, 0],
      [10, 5],
      [0, 5],
    ]
    const layout = layoutNaturalCopingStones(points, {
      width: 0.6,
      thickness: 0.2,
      stoneLength: 1,
      jointWidth: 0.02,
      irregularity: 0.35,
      seed: 7,
      rockLike: true,
    })

    const corners = layout
      .filter((stone) => stone.cornerPoint)
      .map((stone) => stone.cornerPoint)

    expect(corners).toHaveLength(4)
    expect(new Set(corners.map((corner) => corner?.join(',')))).toEqual(
      new Set(['0,0', '10,0', '10,5', '0,5']),
    )
    expect(layout.some((stone) => !stone.cornerPoint)).toBe(true)
  })

  test('lays smooth freeform boundaries without artificial corner pieces', () => {
    const points: [number, number][] = Array.from({ length: 24 }, (_, index) => {
      const angle = index / 24 * Math.PI * 2
      return [Math.cos(angle) * 5, Math.sin(angle) * 2.5]
    })
    const layout = layoutNaturalCopingStones(points, {
      width: 0.6,
      thickness: 0.2,
      stoneLength: 1,
      jointWidth: 0.02,
      irregularity: 0.75,
      seed: 7,
      rockLike: true,
      smoothBoundary: true,
    })

    expect(layout.length).toBeGreaterThan(10)
    expect(layout.length).toBeLessThan(points.length)
    expect(layout.every((stone) => !stone.cornerPoint)).toBe(true)
    expect(layout.every((stone) => stone.length > 0.9)).toBe(true)

    const naturalStoneLayout = layoutNaturalCopingStones(points, {
      width: 0.6,
      thickness: 0.2,
      stoneLength: 1,
      jointWidth: 0.02,
      irregularity: 0.75,
      seed: 7,
      smoothBoundary: true,
    })
    expect(naturalStoneLayout.every((stone) => !stone.cornerPoint)).toBe(true)
  })
})
