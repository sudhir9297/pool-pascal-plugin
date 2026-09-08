import { describe, expect, test } from 'bun:test'
import { createImmersiveXRPoolWaterMaterial } from './water-effect'

describe('immersive XR pool water', () => {
  test('uses a transparent color material without viewport render nodes', () => {
    const material = createImmersiveXRPoolWaterMaterial({ waterColor: '#123456' })

    expect(material.color.getHexString()).toBe('123456')
    expect(material.transparent).toBe(true)
    expect(material.depthWrite).toBe(false)
    expect(material.colorNode).toBeNull()
    expect(material.positionNode).toBeNull()

    material.dispose()
  })
})
