import { describe, expect, test } from 'bun:test'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { disposePoolSpilloverVisual } from './dispose-visual'

describe('spillover visual disposal', () => {
  test('disposes shared effect materials through their owner only once', () => {
    const root = new Group()
    const material = new MeshBasicMaterial()
    const geometry = new BoxGeometry()
    root.add(new Mesh(geometry, material), new Mesh(geometry, material))
    let effectDisposals = 0
    let materialDisposals = 0
    material.dispose = () => { materialDisposals += 1 }
    root.userData.waterEffects = [{ material, dispose: () => { effectDisposals += 1 } }]

    disposePoolSpilloverVisual(root)

    expect(effectDisposals).toBe(1)
    expect(materialDisposals).toBe(0)
  })
})
