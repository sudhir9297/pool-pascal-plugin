import { expect, test } from 'bun:test'
import { routePipe, segmentHitsBox, type RoutePoint } from './pipe-route'

test('underground routes use the requested depth even when overhead is shorter', () => {
  const path = routePipe([0, 0.5, 0], [3, 0.5, 0], [1, 0, 0], [-1, 0, 0], [], 0.3, 0.07, -2)!
  expect(path).not.toBeNull()
  expect(Math.min(...path.map((p) => p[1]))).toBe(-2)
  expect(Math.max(...path.map((p) => p[1]))).toBe(0.5)
  expect(path.some((p, i) => i > 0 && p[1] === -2 && path[i - 1]![1] === -2)).toBe(true)
})

test('upward equipment sockets use a short offset before descending', () => {
  const path = routePipe([0, 0.5, 0], [3, 0.5, 0], [0, 1, 0], [-1, 0, 0], [], 0.3, 0.07, -1)!
  expect(path).not.toBeNull()
  expect(path[1]).toEqual([0, 0.8, 0])
  expect(Math.min(...path.map((p) => p[1]))).toBe(-1)
})

test('blocked underground approaches do not fall back above ground', () => {
  const slab = { min: [-10, -0.2, -10] as RoutePoint, max: [10, 0, 10] as RoutePoint }
  expect(routePipe([0, 0.5, 0], [3, 0.5, 0], [1, 0, 0], [-1, 0, 0], [slab], 0.3, 0.07, -1)).toBeNull()
})

test('upward sockets clear wide equipment before descending underground', () => {
  const host = { min: [-1, 0, -1] as RoutePoint, max: [1, 1, 1] as RoutePoint, startHost: true }
  const path = routePipe([0, 1, 0], [4, 0.5, 0], [0, 1, 0], [-1, 0, 0], [host], 0.3, 0.07, -2)!
  expect(path).not.toBeNull()
  expect(path[1]).toEqual([0, 1.3, 0])
  expect(Math.min(...path.map((p) => p[1]))).toBe(-2)
  // Only the initial socket lead may touch the host.
  for (let i = 2; i < path.length; i++) expect(segmentHitsBox(path[i - 1]!, path[i]!, host)).toBe(false)
})

test('leaves and approaches sockets along their outward directions', () => {
  const path = routePipe([0, 0, 0], [3, 1, 0], [1, 0, 0], [1, 0, 0], [], 0.4, 0.07)!
  expect(path).not.toBeNull()
  expect(path[1]![0]).toBeGreaterThan(0)
  expect(path[1]![1]).toBe(0)
  expect(path.at(-2)![0]).toBeGreaterThan(3)
  expect(path.at(-2)![1]).toBe(1)
})

test('routes around an obstacle instead of crossing its center', () => {
  const box = { min: [1, -1, -1] as RoutePoint, max: [2, 1, 1] as RoutePoint }
  const path = routePipe([0, 0, 0], [3, 0, 0], [1, 0, 0], [-1, 0, 0], [box], 0.3, 0.07)!
  expect(path).not.toBeNull()
  for (let i = 1; i < path.length; i++) expect(segmentHitsBox(path[i - 1]!, path[i]!, box)).toBe(false)
})

test('rejects a blocked socket approach, including an unrelated overlapping item', () => {
  const box = { min: [-0.1, -1, -1] as RoutePoint, max: [1, 1, 1] as RoutePoint }
  expect(routePipe([0, 0, 0], [3, 0, 0], [1, 0, 0], [-1, 0, 0], [box], 0.3, 0.07)).toBeNull()
})

test('can exit a socket host but cannot re-enter it along the middle route', () => {
  const box = { min: [-1, -1, -1] as RoutePoint, max: [0.1, 1, 1] as RoutePoint, startHost: true }
  const path = routePipe([0, 0, 0], [3, 0, 0], [1, 0, 0], [-1, 0, 0], [box], 0.3, 0.07)!
  expect(path).not.toBeNull()
  expect(path[0]).toEqual([0, 0, 0])
  expect(path.at(-1)).toEqual([3, 0, 0])
})
