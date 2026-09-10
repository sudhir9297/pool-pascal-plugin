import { expect, test } from 'bun:test'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { conformSpillwayToBoundary } from './geometry'

test('housing follows the boundary in a shared frame without changing lip height', () => {
  const housing = new Group()
  const material = new MeshStandardMaterial()
  const part = new Mesh(new BoxGeometry(2, 0.2, 0.8, 8, 1, 4), material)
  part.position.set(0.3, 1.2, 0.4)
  part.rotation.x = 0.1
  part.updateMatrix()
  housing.add(part)
  const positions = part.geometry.getAttribute('position')
  const before = Array.from({ length: positions.count }, (_, i) => new Vector3().fromBufferAttribute(positions, i).applyMatrix4(part.matrix))
  conformSpillwayToBoundary(housing, [[-2, 0.6], [0, 0], [2, 0.6]])
  for (const [index, original] of before.entries()) {
    const result = new Vector3().fromBufferAttribute(positions, index).applyMatrix4(part.matrix)
    expect(result.x).toBeCloseTo(original.x, 5)
    expect(result.y).toBeCloseTo(original.y, 5)
    expect(result.z - original.z).toBeCloseTo(Math.abs(original.x) * 0.3, 5)
  }
  expect(part.geometry.boundingBox?.isEmpty()).toBe(false)
  part.geometry.dispose(); material.dispose()
})
