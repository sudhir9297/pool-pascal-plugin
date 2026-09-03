import { DataTexture, DoubleSide, LinearFilter, MeshBasicNodeMaterial, NoColorSpace, RGBAFormat, RepeatWrapping, UnsignedByteType } from 'three/webgpu'
import {
  cameraFar,
  cameraNear,
  color,
  float,
  mix,
  normalLocal,
  perspectiveDepthToViewZ,
  positionView,
  screenUV,
  sin,
  smoothstep,
  step,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  viewportDepthTexture,
} from 'three/tsl'
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, TextureLoader, type Texture } from 'three'
import {
  getWaterPresetSettings,
  type WaterPreset,
} from './water-presets'

const NOISE_URLS = {
  caustic1: new URL('./assets/water/caustic1.png', import.meta.url).href,
  caustic2: new URL('./assets/water/caustic2.png', import.meta.url).href,
  noise1: new URL('./assets/water/noise1.png', import.meta.url).href,
  noise4: new URL('./assets/water/noise4.png', import.meta.url).href,
  noise5: new URL('./assets/water/noise5.png', import.meta.url).href,
} as const
const WATERFALL_PRESET_TEXTURES: Record<WaterPreset, {
  mask: keyof typeof NOISE_URLS
  detail: keyof typeof NOISE_URLS
}> = {
  'crystal-clear': { mask: 'caustic1', detail: 'noise5' },
  'vivid-aqua': { mask: 'caustic2', detail: 'noise1' },
  'tropical-lagoon': { mask: 'caustic1', detail: 'noise4' },
}
const waterfallViewportDepth = viewportDepthTexture()
const waterfallTextureCache = new Map<string, Texture>()

export type WaterfallWaterStyle = {
  waterPreset: WaterPreset
  shallowWaterColor: string
  deepWaterColor: string
}

function resolveWaterfallStyle(input: Partial<WaterfallWaterStyle>) {
  const preset = getWaterPresetSettings(input.waterPreset)
  return {
    ...preset,
    shallowWaterColor: typeof input.shallowWaterColor === 'string'
      ? input.shallowWaterColor
      : preset.shallowWaterColor,
    deepWaterColor: typeof input.deepWaterColor === 'string'
      ? input.deepWaterColor
      : preset.deepWaterColor,
  }
}

function fallbackNoise(): Texture {
  const data = new Uint8Array([
    32, 128, 255, 255, 224, 96, 255, 255,
    192, 220, 255, 255, 64, 160, 255, 255,
  ])
  const result = new DataTexture(data, 2, 2, RGBAFormat, UnsignedByteType)
  result.needsUpdate = true
  return result
}

function loadNoise(url: string) {
  const cached = waterfallTextureCache.get(url)
  if (cached) return cached
  const result = typeof document === 'undefined' ? fallbackNoise() : new TextureLoader().load(url)
  result.wrapS = RepeatWrapping
  result.wrapT = RepeatWrapping
  result.colorSpace = NoColorSpace
  result.minFilter = LinearFilter
  result.magFilter = LinearFilter
  waterfallTextureCache.set(url, result)
  return result
}

function dropletTexture() {
  const size = 16
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      const dx = (x + 0.5) / size * 2 - 1
      const dy = (y + 0.5) / size * 2 - 1
      const alpha = Math.max(0, Math.min(1, (1 - Math.sqrt(dx * dx + dy * dy)) * 4))
      data[offset] = 255
      data[offset + 1] = 255
      data[offset + 2] = 255
      data[offset + 3] = Math.round(alpha * 255)
    }
  }
  const result = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  result.needsUpdate = true
  result.minFilter = LinearFilter
  result.magFilter = LinearFilter
  return result
}

/**
 * TSL port of the Turtle Falls material. The mesh UV follows the whole flow
 * path from the water inside the spillway at y=0 to the landing at y=1.
 */
export class WaterfallWaterEffect {
  readonly material: MeshBasicNodeMaterial
  private readonly time = uniform(0)
  private readonly shallowColor = uniform(color('#83eab3'))
  private readonly deepColor = uniform(color('#008ab3'))

  constructor(styleInput: Partial<WaterfallWaterStyle>, flowStrength = 1) {
    const settings = resolveWaterfallStyle(styleInput)
    const selected = WATERFALL_PRESET_TEXTURES[settings.waterPreset]
    const maskTexture = texture(loadNoise(NOISE_URLS[selected.mask]))
    const detailNoise = texture(loadNoise(NOISE_URLS[selected.detail]))
    this.shallowColor.value.set(settings.shallowWaterColor)
    this.deepColor.value.set(settings.deepWaterColor)
    const coordinates = uv()
    const speed = Math.max(0.2, Math.min(2, flowStrength))
    const presetSpeed = Math.max(0.55, Math.abs(settings.causticsSpeed))
    const time = this.time.mul(-0.15 * speed * presetSpeed / 1.3)
    const detailScale = settings.surfaceDetail / 1.6

    // The bundle bends x with three frequencies before sampling the masks.
    const distortedX = coordinates.x
      .add(sin(coordinates.y.mul(63 * detailScale).add(time)).mul(0.005))
      .add(sin(coordinates.y.mul(39 * detailScale).add(time)).mul(0.01))
      .sub(sin(coordinates.y.mul(1.9).add(time)).mul(0.01))
    const flow = coordinates.y.add(time)
    const slowFlow = coordinates.y.add(time.mul(0.7))
    const fastFlow = coordinates.y.add(time.mul(1.5))

    const primaryScale = Math.max(1.35, settings.causticsScale * 0.72)
    const secondaryScale = Math.max(2.1, settings.causticsScale * 1.08)
    const maskA = maskTexture.sample(vec2(distortedX, slowFlow).mul(primaryScale)).g.min(0.03)
    const maskB = maskTexture.sample(
      vec2(distortedX, flow).mul(secondaryScale).add(vec2(1.7)),
    ).g.min(0.3)
    const pattern = maskA.add(maskB)

    // The authored curve changes its normal from up to forward. This is the
    // same signal the reference uses to grow turbulent foam over the lip.
    const noise = detailNoise.sample(vec2(distortedX.mul(1.5 * detailScale), fastFlow.mul(0.2)))
    const upward = smoothstep(0.1, 1, normalLocal.y)
    const foamInput = noise.g.add(normalLocal.y).sub(0.1)
    const foamStart = smoothstep(0.3, 0.4, foamInput)
    const foamEnd = smoothstep(foamInput, foamInput.add(0.1), float(0.99))
    const fallFoam = foamStart.oneMinus().min(0.2).add(foamStart.mul(foamEnd))

    const material = new MeshBasicNodeMaterial({
      color: settings.shallowWaterColor,
      transparent: false,
      depthWrite: true,
      side: DoubleSide,
      toneMapped: false,
    })

    const sceneEye = perspectiveDepthToViewZ(
      waterfallViewportDepth.sample(screenUV),
      cameraNear,
      cameraFar,
    ).negate()
    const fragmentEye = positionView.z.negate()
    const depthDelta = sceneEye.sub(fragmentEye).max(0)
    const depth = smoothstep(0.1, 1, float(1).sub(depthDelta))
    const foamNoise = detailNoise.sample(vec2(distortedX, flow).mul(1.3 * detailScale)).r
    const brokenContact = smoothstep(
      0.9,
      0.999,
      depth.div(step(0.2, foamNoise).max(0.001)),
    )

    const clarity = Math.max(0.3, Math.min(3, settings.clarity))
    const darkWater = this.deepColor.mul(0.26 + 0.08 / clarity)
    const litWater = mix(darkWater, this.shallowColor.mul(0.78), depth.min(upward))
    const patternGain = 0.72 + Math.min(4, settings.causticsStrength) * 0.08
    const foamGain = 0.78 + settings.shorelineStrength * 0.18 + settings.normalStrength * 0.07
    const brightness = pattern.mul(patternGain)
      .add(fallFoam.mul(foamGain))
      .add(brokenContact.max(0.5).sub(0.5))
    const foamColor = mix(this.shallowColor, color('#f2fdff'), 0.82)
    material.colorNode = litWater.add(foamColor.mul(vec3(brightness)))
    this.material = material
  }

  update(delta: number) {
    this.time.value += Math.min(delta, 0.05)
  }

  dispose() {
    this.material.dispose()
  }
}

/** Lightweight impact disc retained for the legacy standalone spillover node. */
export class WaterfallImpactEffect {
  readonly material: MeshBasicNodeMaterial

  constructor(waterColor = '#d9ffff') {
    this.material = new MeshBasicNodeMaterial({
      color: waterColor,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    })
  }

  update(_delta: number) {}

  dispose() {
    this.material.dispose()
  }
}

/** Small, low-cost animated spray particles for the impact zone. */
export class WaterfallMistEffect {
  readonly points: Points
  readonly material: PointsMaterial
  private readonly base: Array<[number, number, number, number]> = []
  private time = 0

  constructor(width: number, z: number, waterColor = '#d9ffff') {
    const count = Math.max(32, Math.min(72, Math.round(width * 44)))
    const positions = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) {
      const seed = index * 1.731
      const x = Math.sin(seed * 2.1) * width * 0.42
      const y = 0.035 + (Math.sin(seed * 3.7) * 0.5 + 0.5) * 0.28
      const depth = z + (Math.cos(seed * 1.4) * 0.5 + 0.5) * 0.2
      this.base.push([x, y, depth, 0.78 + (Math.sin(seed) * 0.5 + 0.5) * 1.05])
      positions[index * 3] = x
      positions[index * 3 + 1] = y
      positions[index * 3 + 2] = depth
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    this.material = new PointsMaterial({
      color: waterColor,
      map: dropletTexture(),
      size: 0.042,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    this.points = new Points(geometry, this.material)
    this.points.name = 'waterfall-mist'
    this.points.renderOrder = 3
  }

  update(delta: number) {
    this.time += Math.min(delta, 0.05)
    const positions = this.points.geometry.getAttribute('position')
    for (let index = 0; index < this.base.length; index += 1) {
      const [x, y, z, speed] = this.base[index]!
      const phase = (this.time * speed + index * 0.61803398875) % 1
      const lift = 0.34 + (Math.sin(index * 2.47) * 0.5 + 0.5) * 0.24
      const drift = phase * (0.07 + (Math.cos(index * 1.91) * 0.5 + 0.5) * 0.08)
      positions.setXYZ(
        index,
        x + Math.sin(index * 1.37) * drift,
        y + lift * phase - 0.31 * phase * phase,
        z + Math.cos(index * 1.13) * drift,
      )
    }
    positions.needsUpdate = true
  }

  dispose() {
    this.points.geometry.dispose()
    this.material.map?.dispose()
    this.material.dispose()
  }
}

/** Animated horizontal water used for the plunge pool and the source shelf. */
export class WaterfallPoolEffect {
  readonly material: MeshBasicNodeMaterial
  private readonly time = uniform(0)
  private readonly shallowColor = uniform(color('#83eab3'))
  private readonly deepColor = uniform(color('#008ab3'))

  constructor(styleInput: Partial<WaterfallWaterStyle>) {
    const settings = resolveWaterfallStyle(styleInput)
    const selected = WATERFALL_PRESET_TEXTURES[settings.waterPreset]
    const detailNoise = texture(loadNoise(NOISE_URLS[selected.detail]))
    this.shallowColor.value.set(settings.shallowWaterColor)
    this.deepColor.value.set(settings.deepWaterColor)
    const coordinates = uv()
    const detailScale = settings.surfaceDetail / 1.6
    const motion = this.time.mul(settings.normalSpeed * 0.14)
    const broadWave = sin(coordinates.x.mul(25 * detailScale)
      .add(coordinates.y.mul(17 * detailScale)).add(motion)).mul(0.5).add(0.5)
    const crossWave = sin(coordinates.x.mul(-19 * detailScale)
      .add(coordinates.y.mul(31 * detailScale)).sub(motion.mul(0.78))).mul(0.5).add(0.5)
    const textureWave = detailNoise.sample(
      coordinates.mul(settings.causticsScale * 1.4).add(vec2(motion.mul(0.21), motion.mul(-0.13))),
    ).r
    const highlight = smoothstep(0.9, 0.99, broadWave).mul(0.27)
      .add(smoothstep(0.93, 0.995, crossWave).mul(0.16))
      .add(smoothstep(0.72, 0.94, textureWave).mul(0.16 + settings.causticsStrength * 0.025))
    const material = new MeshBasicNodeMaterial({
      color: settings.shallowWaterColor,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    })
    const waterTint = mix(this.deepColor.mul(0.64), this.shallowColor, broadWave.mul(0.22).add(0.34))
    material.colorNode = mix(waterTint, color('#e8fcff'), highlight.mul(0.42))
    material.opacityNode = float(Math.min(0.9, 0.72 + settings.clarity * 0.06))
      .add(highlight.mul(0.06))
    this.material = material
  }

  update(delta: number) {
    this.time.value += Math.min(delta, 0.05)
  }

  dispose() {
    this.material.dispose()
  }
}
