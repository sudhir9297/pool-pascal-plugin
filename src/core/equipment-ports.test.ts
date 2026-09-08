import { describe, expect, test } from 'bun:test'
import type { NodePort } from '@pascal-app/core'
import { poolDrainDefinition } from '../drain/core/definition'
import { getDrainPortPosition } from '../drain/core/geometry'
import { PoolDrainNode } from '../drain/core/schema'
import { poolFilterDefinition } from '../filter/core/definition'
import { getFilterPortPositions } from '../filter/core/geometry'
import { PoolFilterNode } from '../filter/core/schema'
import { poolHeaterDefinition } from '../heater/core/definition'
import { getHeaterPortPositions } from '../heater/core/geometry'
import { PoolHeaterNode } from '../heater/core/schema'
import { poolInletDefinition } from '../inlet/core/definition'
import { PoolInletNode } from '../inlet/core/schema'
import { poolPumpDefinition } from '../pump/core/definition'
import { getPumpPortPositions } from '../pump/core/geometry'
import { PoolPumpNode } from '../pump/core/schema'
import { poolSkimmerDefinition } from '../skimmer/core/definition'
import { PoolSkimmerNode } from '../skimmer/core/schema'
import { poolValveDefinition } from '../valve/core/definition'
import { PoolValveNode } from '../valve/core/schema'

function expectPointClose(actual: readonly number[], expected: readonly number[]) {
  expect(actual[0]).toBeCloseTo(expected[0]!)
  expect(actual[1]).toBeCloseTo(expected[1]!)
  expect(actual[2]).toBeCloseTo(expected[2]!)
}

function expectDwvPorts(ports: NodePort[], expectedIds: string[], diameterM = 0.05) {
  expect(ports.map((port) => port.id)).toEqual(expectedIds)
  for (const port of ports) {
    expect(port.system).toBe('waste')
    expect(port.shape).toBe('round')
    expect(port.diameter).toBeCloseTo(diameterM / 0.0254)
    expect(Math.hypot(...port.direction)).toBeCloseTo(1)
  }
}

describe('pool equipment DWV ports', () => {
  test('advertises every connectable pool socket through NodeDefinition.ports', () => {
    const pump = PoolPumpNode.parse({ position: [2, 0.4, -1], rotation: [0.2, 0.7, -0.1] })
    const filter = PoolFilterNode.parse({ position: [-3, 0.1, 2], rotation: [0, 0.4, 0] })
    const heater = PoolHeaterNode.parse({ position: [1, 0.2, 4], rotation: [0, -0.6, 0] })
    const valve = PoolValveNode.parse({ variant: 'three-way', rotation: [0.1, 0.8, 0.3] })
    const drain = PoolDrainNode.parse({ position: [5, -1.2, 3], rotation: [0, 0.5, 0] })
    const inlet = PoolInletNode.parse({ position: [4, -0.3, 2], rotation: [0, Math.PI / 2, 0] })
    const skimmer = PoolSkimmerNode.parse({ position: [-2, 0.8, 1], rotation: [0, -Math.PI / 2, 0] })

    const pumpPorts = poolPumpDefinition.ports!(pump)
    const filterPorts = poolFilterDefinition.ports!(filter)
    const heaterPorts = poolHeaterDefinition.ports!(heater)
    const valvePorts = poolValveDefinition.ports!(valve)
    const drainPorts = poolDrainDefinition.ports!(drain)
    const inletPorts = poolInletDefinition.ports!(inlet)
    const skimmerPorts = poolSkimmerDefinition.ports!(skimmer)

    expectDwvPorts(pumpPorts, ['inlet', 'outlet'])
    expectDwvPorts(filterPorts, ['inlet', 'outlet', 'waste'])
    expectDwvPorts(heaterPorts, ['inlet', 'outlet'])
    expectDwvPorts(valvePorts, ['left', 'right', 'branch'])
    expectDwvPorts(drainPorts, ['suction'])
    expectDwvPorts(inletPorts, ['return'])
    expectDwvPorts(skimmerPorts, ['suction'])

    getPumpPortPositions(pump).forEach((position, index) => expectPointClose(pumpPorts[index]!.position, position.toArray()))
    getFilterPortPositions(filter).forEach((position, index) => expectPointClose(filterPorts[index]!.position, position.toArray()))
    getHeaterPortPositions(heater).forEach((position, index) => expectPointClose(heaterPorts[index]!.position, position.toArray()))
    expectPointClose(drainPorts[0]!.position, getDrainPortPosition(drain).toArray())
  })

  test('uses distribution roles understood by the editor system graph', () => {
    expect(poolPumpDefinition.distributionRole).toBe('equipment')
    expect(poolFilterDefinition.distributionRole).toBe('equipment')
    expect(poolHeaterDefinition.distributionRole).toBe('equipment')
    expect(poolValveDefinition.distributionRole).toBe('fitting')
    expect(poolDrainDefinition.distributionRole).toBe('terminal')
    expect(poolInletDefinition.distributionRole).toBe('terminal')
    expect(poolSkimmerDefinition.distributionRole).toBe('terminal')
  })
})
