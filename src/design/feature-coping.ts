import { Group, Mesh } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import type { PoolPoint } from '../core/schema'
import { createRockGeometry } from './coping'
import { getPoolRockColor } from './rock-colors'

export type SubmergedFeatureCopingOptions = {
  width: number
  thickness: number
  stoneLength: number
  irregularity: number
  seed: number
  color: string
  topDepth: number
}

/** Builds the smaller rock run at a submerged shelf or bench transition. */
export function buildSubmergedFeatureCopingGeometry(
  start: PoolPoint,
  end: PoolPoint,
  options: SubmergedFeatureCopingOptions,
) {
  const group = new Group()
  group.name = 'pool-submerged-feature-coping'
  const length = Math.hypot(end[0] - start[0], end[1] - start[1])
  if (length <= 0.001) return group

  const tangent: PoolPoint = [(end[0] - start[0]) / length, (end[1] - start[1]) / length]
  const count = Math.max(1, Math.round(length / Math.max(0.2, options.stoneLength)))
  const stoneLength = length / count * 0.97

  for (let index = 0; index < count; index += 1) {
    const centerDistance = (index + 0.5) * length / count
    const center: PoolPoint = [
      start[0] + tangent[0] * centerDistance,
      start[1] + tangent[1] * centerDistance,
    ]
    const variation = (Math.sin(options.seed * 0.019 + index * 2.173) * 0.5 + 0.5) - 0.5
    const width = Math.max(0.08, options.width * 0.72 * (1 + variation * options.irregularity * 0.2))
    const height = Math.max(0.02, options.thickness * 0.82 * (1 + variation * options.irregularity * 0.2))
    const geometry = createRockGeometry(
      stoneLength,
      width,
      height,
      options.seed + index * 7919,
    )
    const color = getPoolRockColor(options.seed, index)
    const material = new MeshStandardNodeMaterial({ color, roughness: 0.9, metalness: 0 })
    const stone = new Mesh(geometry, material)
    stone.name = `pool-submerged-feature-rock-${index + 1}`
    stone.position.set(
      center[0],
      -options.topDepth - height * 0.6,
      center[1],
    )
    stone.rotation.y = -Math.atan2(tangent[1], tangent[0])
    group.add(stone)
  }
  return group
}
