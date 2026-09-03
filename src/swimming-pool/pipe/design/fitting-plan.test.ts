import { describe, expect, test } from 'bun:test'
import { planPipeCross, planPipeElbow, planPipeFitting, planPipeTee, planPipeY } from './fitting-plan'

describe('PVC fitting plans', () => {
  test('plans an elbow with deterministic collar points', () => {
    const fitting = planPipeElbow([1, 2, 3], [1, 0, 0], [0, 0, 1], 0.1)
    expect(fitting.portDirections).toEqual([[1, 0, 0], [0, 0, 1]])
    expect(fitting.collarPoints).toEqual([[1.115, 2, 3], [1, 2, 3.115]])
  })

  test('requires the correct number of ports for tee and Y fittings', () => {
    expect(planPipeTee([0, 0, 0], [[1, 0, 0], [-1, 0, 0], [0, 0, 1]], 0.1)?.kind).toBe('tee')
    expect(planPipeY([0, 0, 0], [[1, 0, 0], [0, 0, 1], [-1, 0, 1]], 0.1)?.kind).toBe('y')
    expect(planPipeTee([0, 0, 0], [[1, 0, 0], [-1, 0, 0]], 0.1)).toBeNull()
  })

  test('plans a four-port cross, including a two-leg crossing representation', () => {
    const explicit = planPipeCross([0, 0, 0], [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]], 0.1)
    const crossing = planPipeFitting('cross', [0, 0, 0], [[1, 0, 0], [-1, 0, 0]], 0.1)
    expect(explicit?.collarPoints).toHaveLength(4)
    expect(crossing?.portDirections).toHaveLength(4)
    expect(crossing?.portDirections[2]?.[0]).toBeCloseTo(0)
    expect(crossing?.portDirections[2]?.[2]).toBeCloseTo(1)
    expect(crossing?.portDirections[3]?.[0]).toBeCloseTo(0)
    expect(crossing?.portDirections[3]?.[2]).toBeCloseTo(-1)
  })
})
