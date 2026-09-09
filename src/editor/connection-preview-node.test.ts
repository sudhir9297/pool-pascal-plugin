import { expect, test } from 'bun:test'
import { PoolFilterNode } from '../filter/core/schema'
import { PoolPumpNode } from '../pump/core/schema'
import { PoolHeaterNode } from '../heater/core/schema'
import { connectionPreviewNode } from './connection-preview-node'

test('filter pipe preview preserves the tank diameter while matching its sockets', () => {
  const filter = PoolFilterNode.parse({})
  const preview = connectionPreviewNode(filter, 0.0508)
  expect(preview.diameter).toBe(filter.diameter)
  expect(preview.bodyHeight).toBe(filter.bodyHeight)
  expect(preview.portDiameter).toBe(0.0508)
  expect(filter).toEqual(PoolFilterNode.parse({ ...filter }))
  expect(connectionPreviewNode(filter, null)).toBe(filter)
})

test('pump and heater previews match their respective connection fields', () => {
  const pump = PoolPumpNode.parse({})
  const heater = PoolHeaterNode.parse({})
  expect(connectionPreviewNode(pump, 0.0508)).toEqual({ ...pump, diameter: 0.0508 })
  expect(connectionPreviewNode(heater, 0.0508)).toEqual({ ...heater, portDiameter: 0.0508 })
})
