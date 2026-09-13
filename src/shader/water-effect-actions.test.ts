import { expect, test } from 'bun:test'
import type { WebGPURenderer } from 'three/webgpu'
import { PoolWaterEffect } from './water-effect'
import { PoolNode } from '../core/schema'

test('saved water mode survives a move and effect recreation', () => {
  for (const waterMode of ['calm', 'storm'] as const) {
    const pool = PoolNode.parse({ waterMode })
    const moved = PoolNode.parse(JSON.parse(JSON.stringify({ ...pool, position: [4, 0, 2] })))
    const effect = new PoolWaterEffect(moved, 16)
    expect(effect.waterMode).toBe(waterMode)
    effect.setSettings({ ...moved, waterColor: '#ffffff' })
    expect(effect.waterMode).toBe(waterMode)
    effect.setSettings({ ...moved, waterMode: 'base' })
    expect(effect.waterMode).toBe('base')
    effect.dispose()
  }
  expect(PoolNode.parse({}).waterMode).toBe('base')
})

function rendererStub() {
  let passes = 0
  return {
    renderer: {
      autoClear: false,
      getRenderTarget: () => null,
      setRenderTarget() {},
      render() { passes++ },
    } as unknown as WebGPURenderer,
    passes: () => passes,
  }
}

  test('repeated queued disturbances and a resumed frame have bounded simulation work', () => {
  const effect = new PoolWaterEffect({}, 16)
  const { renderer, passes } = rendererStub()
  for (let i = 0; i < 100; i++) effect.addDrop(0.5, 0.5)
  effect.storm()
  effect.update(renderer, 120)
  expect(passes()).toBeLessThanOrEqual(22)
  expect(renderer.autoClear).toBe(false)
  effect.dispose()
})
