import { describe, expect, test } from 'bun:test'
import type { NodeDefinition } from '@pascal-app/core'
import type { z } from 'zod'
import { poolDefinition } from './definition'
import { DEFAULT_POOL, PoolNode } from './schema'
import { poolDrainDefinition } from '../drain/core/definition'
import { DEFAULT_POOL_DRAIN, PoolDrainNode } from '../drain/core/schema'
import { poolFilterDefinition } from '../filter/core/definition'
import { DEFAULT_POOL_FILTER, PoolFilterNode } from '../filter/core/schema'
import { poolHeaterDefinition } from '../heater/core/definition'
import { DEFAULT_POOL_HEATER, PoolHeaterNode } from '../heater/core/schema'
import { poolInletDefinition } from '../inlet/core/definition'
import { DEFAULT_POOL_INLET, PoolInletNode } from '../inlet/core/schema'
import { poolPumpDefinition } from '../pump/core/definition'
import { DEFAULT_POOL_PUMP, PoolPumpNode } from '../pump/core/schema'
import { poolSkimmerDefinition } from '../skimmer/core/definition'
import { DEFAULT_POOL_SKIMMER, PoolSkimmerNode } from '../skimmer/core/schema'
import { poolSpilloverDefinition } from '../spillover/core/definition'
import { DEFAULT_POOL_SPILLOVER, PoolSpilloverNode } from '../spillover/core/schema'
import { poolStairDefinition } from '../stair/core/definition'
import { DEFAULT_POOL_STAIR, PoolStairNode } from '../stair/core/schema'
import { poolValveDefinition } from '../valve/core/definition'
import { DEFAULT_POOL_VALVE, PoolValveNode } from '../valve/core/schema'
import { poolWaterfallDefinition } from '../water-feature/waterfall/core/definition'
import { DEFAULT_POOL_WATERFALL, PoolWaterfallNode } from '../water-feature/waterfall/core/schema'

type Schema = z.ZodType<Record<string, unknown>>

const cases: Array<{
  name: string
  definition: NodeDefinition<Schema>
  schema: Schema
  defaults: Record<string, unknown>
}> = [
  { name: 'pool', definition: poolDefinition as NodeDefinition<Schema>, schema: PoolNode, defaults: DEFAULT_POOL },
  { name: 'drain', definition: poolDrainDefinition as NodeDefinition<Schema>, schema: PoolDrainNode, defaults: DEFAULT_POOL_DRAIN },
  { name: 'filter', definition: poolFilterDefinition as NodeDefinition<Schema>, schema: PoolFilterNode, defaults: DEFAULT_POOL_FILTER },
  { name: 'heater', definition: poolHeaterDefinition as NodeDefinition<Schema>, schema: PoolHeaterNode, defaults: DEFAULT_POOL_HEATER },
  { name: 'inlet', definition: poolInletDefinition as NodeDefinition<Schema>, schema: PoolInletNode, defaults: DEFAULT_POOL_INLET },
  { name: 'pump', definition: poolPumpDefinition as NodeDefinition<Schema>, schema: PoolPumpNode, defaults: DEFAULT_POOL_PUMP },
  { name: 'skimmer', definition: poolSkimmerDefinition as NodeDefinition<Schema>, schema: PoolSkimmerNode, defaults: DEFAULT_POOL_SKIMMER },
  { name: 'spillover', definition: poolSpilloverDefinition as NodeDefinition<Schema>, schema: PoolSpilloverNode, defaults: DEFAULT_POOL_SPILLOVER },
  { name: 'stair', definition: poolStairDefinition as NodeDefinition<Schema>, schema: PoolStairNode, defaults: DEFAULT_POOL_STAIR },
  { name: 'valve', definition: poolValveDefinition as NodeDefinition<Schema>, schema: PoolValveNode, defaults: DEFAULT_POOL_VALVE },
  { name: 'waterfall', definition: poolWaterfallDefinition as NodeDefinition<Schema>, schema: PoolWaterfallNode, defaults: DEFAULT_POOL_WATERFALL },
]

describe('node defaults', () => {
  for (const entry of cases) {
    test(`${entry.name} definition and schema agree`, () => {
      const parsed = entry.schema.parse(entry.definition.defaults())
      const values = Object.fromEntries(Object.keys(entry.defaults).map((key) => [key, parsed[key]]))
      expect(values).toEqual(entry.defaults)
    })
  }
})
