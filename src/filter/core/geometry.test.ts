import { describe, expect, test } from 'bun:test'
import { Box3, Euler, Vector3 } from 'three'
import { PoolFilterNode } from './schema'
import {
  buildFilterGeometry,
  FILTER_FLOOR_CLEARANCE,
  getFilterPortPositions,
  getFilterPortsLocal,
} from './geometry'

describe('pool filter geometry', () => {
  test('builds the reference tank, pedestal, valve, handle, gauge, and badge', () => {
    const group = buildFilterGeometry(PoolFilterNode.parse({ id: 'pool-filter_geometry' }))
    for (const name of [
      'filter-ribbed-tank',
      'filter-flared-pedestal',
      'filter-multiport-valve',
      'filter-selector-handle',
      'filter-pressure-gauge',
      'filter-equipment-badge',
    ]) {
      expect(group.getObjectByName(name), name).toBeDefined()
    }
    expect(group.children.length).toBeGreaterThan(45)
  })

  test('puts every logical endpoint at its visible socket-face centre', () => {
    const node = PoolFilterNode.parse({ id: 'pool-filter_ports' })
    const group = buildFilterGeometry(node)
    group.updateMatrixWorld(true)

    for (const port of getFilterPortsLocal(node)) {
      const marker = group.getObjectByName(`filter-port-${port.role}`)
      expect(marker, port.role).toBeDefined()
      const visibleFaceCentre = marker!.getWorldPosition(new Vector3())
      expect(visibleFaceCentre.distanceTo(port.position), port.role).toBeLessThan(1e-9)
      expect(group.getObjectByName(`filter-port-${port.role}-face`), port.role).toBeDefined()
    }
  })

  test('models side unions and a lower front waste connection on media filters', () => {
    const sandPorts = getFilterPortsLocal(PoolFilterNode.parse({ technology: 'sand' }))
    expect(sandPorts.map((port) => port.role)).toEqual(['inlet', 'outlet', 'waste'])
    expect(sandPorts[0]!.direction.toArray()).toEqual([-1, 0, 0])
    expect(sandPorts[1]!.direction.toArray()).toEqual([1, 0, 0])
    expect(sandPorts[2]!.direction.toArray()).toEqual([0, 0, 1])
    expect(sandPorts[2]!.position.y).toBeLessThan(sandPorts[0]!.position.y)
    expect(getFilterPortsLocal(PoolFilterNode.parse({ technology: 'cartridge' }))).toHaveLength(2)
  })

  test('applies the complete node rotation to world connection coordinates', () => {
    const node = PoolFilterNode.parse({
      id: 'pool-filter_rotated',
      position: [1, 2, 3],
      rotation: [0.15, Math.PI / 2, -0.1],
    })
    const expected = getFilterPortsLocal(node).map((port) => port.position
      .clone()
      .applyEuler(new Euler(...node.rotation))
      .add(new Vector3(...node.position)))
    const actual = getFilterPortPositions(node)
    actual.forEach((point, index) => expect(point.distanceTo(expected[index]!)).toBeLessThan(1e-9))
  })

  test('keeps all rendered geometry above the floor plane', () => {
    const group = buildFilterGeometry(PoolFilterNode.parse({ id: 'pool-filter_floor' }))
    group.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(group)
    expect(bounds.min.y).toBeGreaterThanOrEqual(FILTER_FLOOR_CLEARANCE - 1e-6)
    expect(getFilterPortsLocal(PoolFilterNode.parse({})).every((port) => port.position.y > 0)).toBe(true)
  })

  test('removes the gauge without moving connection points', () => {
    const visible = PoolFilterNode.parse({ showGauge: true })
    const hidden = PoolFilterNode.parse({ showGauge: false })
    expect(buildFilterGeometry(hidden).getObjectByName('filter-pressure-gauge')).toBeUndefined()
    expect(getFilterPortsLocal(hidden).map((port) => port.position.toArray()))
      .toEqual(getFilterPortsLocal(visible).map((port) => port.position.toArray()))
  })
})
