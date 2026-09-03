import { describe, expect, test } from 'bun:test'
import { Box3, Euler, Vector3 } from 'three'
import { buildHeaterGeometry, getHeaterPortPositions, getHeaterPortsLocal } from './geometry'
import { PoolHeaterNode } from './schema'

describe('pool heater geometry', () => {
  test('builds the reference cabinet, twin coil bays, fans, service doors, and side grille', () => {
    const heater = PoolHeaterNode.parse({})
    const geometry = buildHeaterGeometry(heater)

    expect(geometry.getObjectByName('heater-cabinet')).toBeDefined()
    expect(geometry.getObjectByName('heater-dark-plinth')).toBeDefined()
    expect(geometry.getObjectByName('heater-left-bay-coil')).toBeDefined()
    expect(geometry.getObjectByName('heater-right-bay-coil')).toBeDefined()
    expect(geometry.getObjectByName('heater-left-bay-fan-shroud')).toBeDefined()
    expect(geometry.getObjectByName('heater-right-bay-fan-shroud')).toBeDefined()
    expect(geometry.getObjectByName('heater-side-coil')).toBeDefined()
    expect(geometry.getObjectByName('heater-service-door-1')).toBeDefined()
    expect(geometry.getObjectByName('heater-service-door-2')).toBeDefined()
    expect(geometry.getObjectByName('heater-left-top-fan-housing')).toBeDefined()
    expect(geometry.getObjectByName('heater-right-top-fan-housing')).toBeDefined()
  })

  test('keeps inlet first and centers both visible socket faces on their hotspots', () => {
    const heater = PoolHeaterNode.parse({})
    const geometry = buildHeaterGeometry(heater)
    const ports = getHeaterPortsLocal(heater)
    expect(geometry.userData.portOrder).toEqual(['inlet', 'outlet'])
    expect(ports).toHaveLength(2)
    geometry.updateMatrixWorld(true)
    for (const [index, name] of ['heater-port-inlet-face', 'heater-port-outlet-face'].entries()) {
      const face = geometry.getObjectByName(name)
      expect(face?.userData.portRole).toBe(index === 0 ? 'inlet' : 'outlet')
      expect(face!.getWorldPosition(new Vector3()).distanceTo(ports[index]!.position)).toBeLessThan(1e-8)
    }
  })

  test('keeps transformed pipe positions aligned with the visible socket faces', () => {
    const heater = PoolHeaterNode.parse({ position: [1, 0.2, -2], rotation: [0.1, 0.5, -0.2] })
    const rotation = new Euler(...heater.rotation, 'XYZ')
    const translation = new Vector3(...heater.position)
    const geometry = buildHeaterGeometry(heater)
    geometry.updateMatrixWorld(true)

    const visibleFaces = ['heater-port-inlet-face', 'heater-port-outlet-face'].map((name) =>
      geometry.getObjectByName(name)!.getWorldPosition(new Vector3()).applyEuler(rotation).add(translation),
    )
    getHeaterPortPositions(heater).forEach((port, index) => {
      expect(port.distanceTo(visibleFaces[index]!)).toBeLessThan(1e-8)
    })
  })

  test('keeps the cabinet above the host floor', () => {
    const bounds = new Box3().setFromObject(buildHeaterGeometry(PoolHeaterNode.parse({})))
    expect(bounds.min.y).toBeGreaterThanOrEqual(-1e-6)
    expect(bounds.max.y).toBeGreaterThan(0)
  })

  test('separates every top assembly surface to prevent z-fighting', () => {
    const geometry = buildHeaterGeometry(PoolHeaterNode.parse({}))
    geometry.updateMatrixWorld(true)
    const boundsOf = (name: string) => new Box3().setFromObject(geometry.getObjectByName(name)!)
    const cabinet = boundsOf('heater-cabinet')
    const cap = boundsOf('heater-top-cap')
    const housing = boundsOf('heater-left-top-fan-housing')
    const ring = boundsOf('heater-left-top-fan-ring')
    const blade = boundsOf('heater-left-top-fan-blade-1')

    expect(cap.min.y - cabinet.max.y).toBeGreaterThan(0.001)
    expect(housing.min.y - cap.max.y).toBeGreaterThan(0.001)
    expect(ring.min.y - housing.max.y).toBeGreaterThan(0.001)
    expect(blade.min.y - housing.max.y).toBeGreaterThan(0.001)
  })
})
