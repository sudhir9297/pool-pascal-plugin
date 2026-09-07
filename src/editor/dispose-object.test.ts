import { describe, expect, test } from 'bun:test'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { disposeObject3D } from './dispose-object'

describe('procedural object disposal', () => {
  test('disposes shared resources once', () => {
    const geometry = new BoxGeometry()
    const material = new MeshBasicMaterial()
    let geometryDisposals = 0
    let materialDisposals = 0
    geometry.dispose = () => { geometryDisposals += 1 }
    material.dispose = () => { materialDisposals += 1 }
    const group = new Group()
    group.add(new Mesh(geometry, material), new Mesh(geometry, material))

    disposeObject3D(group)

    expect(geometryDisposals).toBe(1)
    expect(materialDisposals).toBe(1)
  })
})
