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
})
