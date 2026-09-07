import { describe, expect, test } from 'bun:test'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { disposeWaterfallVisual } from './dispose-visual'

describe('waterfall visual disposal', () => {
  test('disposes shared resources and delegates effect materials to their owner', () => {
    const root = new Group()
    const sharedGeometry = new BoxGeometry()
    const sharedMaterial = new MeshBasicMaterial()
    const effectMaterial = new MeshBasicMaterial()
    const effect = { material: effectMaterial, disposeCalls: 0, dispose() { this.disposeCalls += 1 } }
    const regularA = new Mesh(sharedGeometry, sharedMaterial)
    const regularB = new Mesh(sharedGeometry, sharedMaterial)
    const animated = new Mesh(new BoxGeometry(), effectMaterial)
    animated.userData.waterfallEffect = effect
    root.add(regularA, regularB, animated)
    let geometryDisposals = 0
    let materialDisposals = 0
    sharedGeometry.dispose = () => { geometryDisposals += 1 }
    sharedMaterial.dispose = () => { materialDisposals += 1 }

    disposeWaterfallVisual(root)

    expect(effect.disposeCalls).toBe(1)
    expect(geometryDisposals).toBe(1)
    expect(materialDisposals).toBe(1)
  })
})
