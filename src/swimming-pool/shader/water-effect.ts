import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  FrontSide,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshBasicNodeMaterial,
  NoColorSpace,
  NodeMaterial,
  QuadMesh,
  RenderTarget,
  RepeatWrapping,
  RGBAFormat,
  TextureLoader,
  UnsignedByteType,
  Vector2,
  Vector3,
  type Texture,
  type WebGPURenderer,
} from 'three/webgpu'
import {
  cameraFar,
  cameraNear,
  cameraPosition,
  color,
  dot,
  exp,
  float,
  max,
  mix,
  normalize,
  perspectiveDepthToViewZ,
  positionLocal,
  positionView,
  positionWorld,
  pow,
  reflect,
  screenUV,
  smoothstep,
  step,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
  viewportDepthTexture,
  viewportSharedTexture,
} from 'three/tsl'
import {
  WATER_PRESET_SETTINGS,
  getWaterPresetSettings,
  type WaterPreset,
  type WaterPresetSettings,
} from './water-presets'

const DEFAULTS = {
  ...WATER_PRESET_SETTINGS.clear,
  sunElevation: 52,
  sunAzimuth: 135,
  waterColor: '#38bdf8',
} as const

/** Motion multipliers from the stylized-water panner equations. */
export const WATER_MOTION_RATES = {
  normalPrimary: -0.05,
  normalSecondary: 0.1,
  caustics: 0.045,
  causticsPrimaryY: 0.43,
  causticsSecondaryX: -0.61,
  causticsSecondaryY: 0.79,
  displacement: 0.075,
} as const

export type WaterSettings = WaterPresetSettings & {
  sunElevation: number
  sunAzimuth: number
  waterColor: string
}

const ASSET_URLS = {
  normal1: new URL('./assets/water/normal1.png', import.meta.url).href,
  normal2: new URL('./assets/water/normal2.png', import.meta.url).href,
  normal3: new URL('./assets/water/normal3.png', import.meta.url).href,
  caustic1: new URL('./assets/water/caustic1.png', import.meta.url).href,
  caustic2: new URL('./assets/water/caustic2.png', import.meta.url).href,
  noise1: new URL('./assets/water/noise1.png', import.meta.url).href,
  noise2: new URL('./assets/water/noise2.png', import.meta.url).href,
  noise4: new URL('./assets/water/noise4.png', import.meta.url).href,
  noise5: new URL('./assets/water/noise5.png', import.meta.url).href,
  white: new URL('./assets/water/white.png', import.meta.url).href,
} as const

const PRESET_TEXTURES: Record<WaterPreset, {
  normal: keyof typeof ASSET_URLS
  caustic: keyof typeof ASSET_URLS
  distortion: keyof typeof ASSET_URLS
  shoreline: keyof typeof ASSET_URLS
}> = {
  clear: { normal: 'normal1', caustic: 'caustic1', distortion: 'noise2', shoreline: 'white' },
  genshin: { normal: 'normal3', caustic: 'caustic2', distortion: 'noise1', shoreline: 'noise1' },
  tropical: { normal: 'normal2', caustic: 'caustic1', distortion: 'noise4', shoreline: 'noise5' },
}

const textureCache = new Map<string, Texture>()
// One base node shares the renderer's immutable depth copy across both the
// straight and refracted samples. Creating one node per sample duplicates the
// full viewport depth copy and is needlessly expensive.
const viewportDepth = viewportDepthTexture()

function fallbackTexture(): Texture {
  const data = new Uint8Array([
    128, 128, 255, 255,
    255, 255, 255, 255,
    128, 128, 255, 255,
    255, 255, 255, 255,
  ])
  const result = new DataTexture(data, 2, 2, RGBAFormat, UnsignedByteType)
  result.needsUpdate = true
  return result
}

function loadWaterTexture(asset: keyof typeof ASSET_URLS) {
  const url = ASSET_URLS[asset]
  const cached = textureCache.get(url)
  if (cached) return cached
  const result = typeof document === 'undefined'
    ? fallbackTexture()
    : new TextureLoader().load(url)
  result.wrapS = RepeatWrapping
  result.wrapT = RepeatWrapping
  result.colorSpace = NoColorSpace
  result.minFilter = LinearMipmapLinearFilter
  result.magFilter = LinearFilter
  result.anisotropy = 16
  textureCache.set(url, result)
  return result
}

function finite(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback
}

/** Resolve saved pools before values are uploaded as renderer uniforms. */
export function resolveWaterSettings(value: Partial<WaterSettings>): WaterSettings {
  const preset = getWaterPresetSettings(value.waterPreset)
  return {
    waterPreset: preset.waterPreset,
    shallowWaterColor: typeof value.shallowWaterColor === 'string'
      ? value.shallowWaterColor
      : preset.shallowWaterColor,
    deepWaterColor: typeof value.deepWaterColor === 'string'
      ? value.deepWaterColor
      : preset.deepWaterColor,
    surfaceDetail: finite(value.surfaceDetail, preset.surfaceDetail, 0.4, 3),
    viscosity: finite(value.viscosity, preset.viscosity, 0, 1),
    rippleSize: finite(value.rippleSize, preset.rippleSize, 8, 80),
    clarity: finite(value.clarity, preset.clarity, 0.3, 3),
    rain: finite(value.rain, preset.rain, 0, 1),
    breeze: finite(value.breeze, preset.breeze, 0, 1),
    normalScale: finite(value.normalScale, preset.normalScale, 0.25, 20),
    normalStrength: finite(value.normalStrength, preset.normalStrength, 0, 2),
    normalSpeed: finite(value.normalSpeed, preset.normalSpeed, -3, 3),
    reflectionStrength: finite(value.reflectionStrength, preset.reflectionStrength, 0, 2),
    reflectionFresnel: finite(value.reflectionFresnel, preset.reflectionFresnel, 1, 12),
    reflectionDistortion: finite(value.reflectionDistortion, preset.reflectionDistortion, 0, 4),
    refractionStrength: finite(value.refractionStrength, preset.refractionStrength, 0, 1),
    causticsStrength: finite(value.causticsStrength, preset.causticsStrength, 0, 4),
    causticsScale: finite(value.causticsScale, preset.causticsScale, 0.25, 12),
    causticsSpeed: finite(value.causticsSpeed, preset.causticsSpeed, -4, 4),
    intersectionStrength: finite(value.intersectionStrength, preset.intersectionStrength, 0, 1),
    intersectionColor: typeof value.intersectionColor === 'string'
      ? value.intersectionColor
      : preset.intersectionColor,
    intersectionWidth: finite(value.intersectionWidth, preset.intersectionWidth, 0.05, 2),
    shorelineStrength: finite(value.shorelineStrength, preset.shorelineStrength, 0, 1),
    shorelineWidth: finite(value.shorelineWidth, preset.shorelineWidth, 0.02, 1),
    shorelineSpeed: finite(value.shorelineSpeed, preset.shorelineSpeed, -3, 3),
    specularStrength: finite(value.specularStrength, preset.specularStrength, 0, 4),
    specularSize: finite(value.specularSize, preset.specularSize, 0, 1),
    specularHardness: finite(value.specularHardness, preset.specularHardness, 0, 1),
    sunElevation: finite(value.sunElevation, DEFAULTS.sunElevation, 14, 86),
    sunAzimuth: finite(value.sunAzimuth, DEFAULTS.sunAzimuth, 0, 360),
    waterColor: typeof value.waterColor === 'string' ? value.waterColor : DEFAULTS.waterColor,
  }
}

type TextureNodeLike = ReturnType<typeof texture> & { value: Texture }

function makeTarget(resolution: number) {
  const target = new RenderTarget(resolution, resolution, {
    depthBuffer: false,
    stencilBuffer: false,
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  })
  target.texture.wrapS = ClampToEdgeWrapping
  target.texture.wrapT = ClampToEdgeWrapping
  target.texture.generateMipmaps = false
  return target
}

/**
 * TSL water combining the supplied height-field solver with the Clear,
 * Genshin, and Tropical normal/refraction/caustic material layers. The same
 * graph compiles through WebGPURenderer for WebGPU or its WebGL 2 fallback.
 */
export class PoolWaterEffect {
  readonly resolution: number
  readonly stateNode: TextureNodeLike
  readonly material: MeshBasicNodeMaterial

  private read: RenderTarget
  private write: RenderTarget
  private readonly quad: QuadMesh
  private readonly updateMaterial: NodeMaterial
  private readonly dropMaterial: NodeMaterial
  private readonly clearMaterial: NodeMaterial
  private readonly inputNode: TextureNodeLike
  private readonly normalTextureNode: TextureNodeLike
  private readonly causticTextureNode: TextureNodeLike
  private readonly distortionTextureNode: TextureNodeLike
  private readonly shorelineTextureNode: TextureNodeLike
  private readonly dropCenter: any
  private readonly dropRadius: any
  private readonly dropStrength: any
  private readonly damping: any
  private readonly simulationDetail: any
  private readonly shallowColor: any
  private readonly deepColor: any
  private readonly normalScale: any
  private readonly normalStrength: any
  private readonly normalSpeed: any
  private readonly reflectionStrength: any
  private readonly reflectionFresnel: any
  private readonly reflectionDistortion: any
  private readonly refractionStrength: any
  private readonly causticsStrength: any
  private readonly causticsScale: any
  private readonly causticsSpeed: any
  private readonly intersectionStrength: any
  private readonly intersectionColor: any
  private readonly intersectionWidth: any
  private readonly shorelineStrength: any
  private readonly shorelineWidth: any
  private readonly shorelineSpeed: any
  private readonly specularStrength: any
  private readonly specularSize: any
  private readonly specularHardness: any
  private readonly time: any
  private readonly sunDirection: any
  private readonly absorption: any
  private initialized = false
  private accumulator = 0
  private rainAccumulator = 0
  private breezeAccumulator = 0
  private drops: Array<[number, number, number, number]> = []
  private settings: WaterSettings

  constructor(settingsInput: Partial<WaterSettings>, resolution = 256) {
    this.settings = resolveWaterSettings(settingsInput)
    this.resolution = resolution
    this.read = makeTarget(resolution)
    this.write = makeTarget(resolution)
    this.inputNode = texture(this.read.texture) as TextureNodeLike
    this.stateNode = texture(this.read.texture) as TextureNodeLike

    const selected = PRESET_TEXTURES[this.settings.waterPreset]
    this.normalTextureNode = texture(loadWaterTexture(selected.normal)) as TextureNodeLike
    this.causticTextureNode = texture(loadWaterTexture(selected.caustic)) as TextureNodeLike
    this.distortionTextureNode = texture(loadWaterTexture(selected.distortion)) as TextureNodeLike
    this.shorelineTextureNode = texture(loadWaterTexture(selected.shoreline)) as TextureNodeLike

    const texel = vec2(1 / resolution, 1 / resolution)
    const sampleUv = uv()
    const current = this.inputNode.sample(sampleUv)
    const left = this.inputNode.sample(sampleUv.sub(vec2(texel.x, 0)))
    const right = this.inputNode.sample(sampleUv.add(vec2(texel.x, 0)))
    const down = this.inputNode.sample(sampleUv.sub(vec2(0, texel.y)))
    const up = this.inputNode.sample(sampleUv.add(vec2(0, texel.y)))
    this.damping = uniform(this.computeDamping())
    this.simulationDetail = uniform(this.settings.surfaceDetail)

    const average = left.r.add(right.r).add(down.r).add(up.r).mul(0.25)
    const velocity = current.g.add(average.sub(current.r).mul(2)).mul(this.damping)
    const height = current.r.add(velocity).clamp(-0.35, 0.35)
    const gradientX = right.r.sub(left.r).mul(this.simulationDetail)
    const gradientZ = up.r.sub(down.r).mul(this.simulationDetail)
    this.updateMaterial = new NodeMaterial()
    this.updateMaterial.fragmentNode = vec4(height as any, velocity as any, gradientX as any, gradientZ as any)
    this.updateMaterial.depthTest = false
    this.updateMaterial.depthWrite = false

    this.dropCenter = uniform(new Vector2(0.5, 0.5))
    this.dropRadius = uniform(0.03)
    this.dropStrength = uniform(0.01)
    const distance = sampleUv.sub(this.dropCenter).length()
    const influence = smoothstep(this.dropRadius, float(0), distance)
    const shaped = float(0.5).sub(influence.mul(Math.PI).cos().mul(0.5))
    this.dropMaterial = new NodeMaterial()
    this.dropMaterial.fragmentNode = vec4(
      current.r.add(shaped.mul(this.dropStrength)) as any,
      current.g as any,
      current.b as any,
      current.a as any,
    )
    this.dropMaterial.depthTest = false
    this.dropMaterial.depthWrite = false

    this.clearMaterial = new NodeMaterial()
    this.clearMaterial.fragmentNode = vec4(0, 0, 0, 0)
    this.clearMaterial.depthTest = false
    this.clearMaterial.depthWrite = false
    this.quad = new QuadMesh(this.updateMaterial)

    this.time = uniform(0)
    this.shallowColor = uniform(new Color(this.settings.shallowWaterColor))
    this.deepColor = uniform(new Color(this.settings.deepWaterColor))
    this.normalScale = uniform(this.settings.normalScale)
    this.normalStrength = uniform(this.settings.normalStrength)
    this.normalSpeed = uniform(this.settings.normalSpeed)
    this.reflectionStrength = uniform(this.settings.reflectionStrength)
    this.reflectionFresnel = uniform(this.settings.reflectionFresnel)
    this.reflectionDistortion = uniform(this.settings.reflectionDistortion)
    this.refractionStrength = uniform(this.settings.refractionStrength)
    this.causticsStrength = uniform(this.settings.causticsStrength)
    this.causticsScale = uniform(this.settings.causticsScale)
    this.causticsSpeed = uniform(this.settings.causticsSpeed)
    this.intersectionStrength = uniform(this.settings.intersectionStrength)
    this.intersectionColor = uniform(new Color(this.settings.intersectionColor))
    this.intersectionWidth = uniform(this.settings.intersectionWidth)
    this.shorelineStrength = uniform(this.settings.shorelineStrength)
    this.shorelineWidth = uniform(this.settings.shorelineWidth)
    this.shorelineSpeed = uniform(this.settings.shorelineSpeed)
    this.specularStrength = uniform(this.settings.specularStrength)
    this.specularSize = uniform(this.settings.specularSize)
    this.specularHardness = uniform(this.settings.specularHardness)
    this.absorption = uniform(-0.62 / this.settings.clarity)
    this.sunDirection = uniform(new Vector3())
    this.updateSunDirection()
    this.material = this.createWaterMaterial()
  }

  private worldWaterUv() {
    return positionWorld.xz.mul(vec2(0.1, -0.1))
  }

  private normalSample() {
    const base = this.worldWaterUv()
    const panA = this.time.mul(this.normalSpeed).mul(WATER_MOTION_RATES.normalPrimary)
    const panB = this.time.mul(this.normalSpeed).mul(WATER_MOTION_RATES.normalSecondary)
    const uvA = base.mul(this.normalScale.mul(0.5)).add(vec2(panA))
    const uvB = base.mul(this.normalScale).add(vec2(panB))
    return mix(
      this.normalTextureNode.sample(uvA).rgb,
      this.normalTextureNode.sample(uvB).rgb,
      0.5,
    ).mul(2).sub(1)
  }

  causticsAt(coordinate: any) {
    const base = coordinate.mul(this.causticsScale)
    const motion = this.time.mul(this.causticsSpeed).mul(WATER_MOTION_RATES.caustics)
    const noise = this.distortionTextureNode.sample(base.add(vec2(
      motion.negate(),
      motion.mul(WATER_MOTION_RATES.causticsPrimaryY),
    ))).r
      .mul(2).sub(1).mul(0.035)
    const uvA = base.add(vec2(
      motion,
      motion.mul(WATER_MOTION_RATES.causticsPrimaryY),
    )).add(vec2(noise))
    const uvB = base.add(vec2(
      motion.mul(WATER_MOTION_RATES.causticsSecondaryX),
      motion.mul(WATER_MOTION_RATES.causticsSecondaryY),
    )).sub(vec2(noise))
    const dual = this.causticTextureNode.sample(uvA).min(this.causticTextureNode.sample(uvB))
    return dual.r.mul(this.causticsStrength)
  }

  private computeDamping() {
    return 0.9993 - this.settings.viscosity * 0.006
  }

  private updateSunDirection() {
    const elevation = (this.settings.sunElevation * Math.PI) / 180
    const azimuth = (this.settings.sunAzimuth * Math.PI) / 180
    this.sunDirection.value.set(
      Math.cos(elevation) * Math.cos(azimuth),
      Math.sin(elevation),
      Math.cos(elevation) * Math.sin(azimuth),
    ).normalize()
  }

  private createWaterMaterial() {
    const material = new MeshBasicNodeMaterial({
      // Keep a real water colour as the base material fallback. Pascal's
      // WebGPU node pipeline can reject an advanced viewport/depth node on
      // some render paths; the previous implicit white default then made the
      // excavated opening look as if the ground plane still covered it.
      color: this.settings.waterColor,
      opacity: 0.82,
      transparent: true,
      depthWrite: false,
      side: FrontSide,
    })
    const state = this.stateNode.sample(uv())
    material.positionNode = positionLocal.add(vec3(0, state.r.mul(WATER_MOTION_RATES.displacement), 0))

    const mapped = this.normalSample()
    const surfaceNormal = normalize(vec3(
      mapped.x.mul(this.normalStrength).sub(state.b.mul(this.simulationDetail)) as any,
      1,
      mapped.y.mul(this.normalStrength).sub(state.a.mul(this.simulationDetail)) as any,
    ))
    const eye = normalize(cameraPosition.sub(positionWorld))
    const facing = max(dot(surfaceNormal, eye), 0)

    const sceneEye = perspectiveDepthToViewZ(
      viewportDepth.sample(screenUV),
      cameraNear,
      cameraFar,
    ).negate()
    const fragmentEye = positionView.z.negate()
    const depthDelta = sceneEye.sub(fragmentEye).max(0)
    const shallowMask = exp(depthDelta.negate().div(0.3)).clamp(0, 1)
    const shoreFade = smoothstep(0, 0.35, shallowMask.oneMinus())

    const refractionOffset = mapped.xy
      .mul(this.refractionStrength)
      .mul(this.reflectionDistortion.mul(0.025))
    const offsetUv = screenUV.add(refractionOffset)
    const offsetDepth = perspectiveDepthToViewZ(
      viewportDepth.sample(offsetUv),
      cameraNear,
      cameraFar,
    ).negate()
    const keepOffset = step(fragmentEye.sub(offsetDepth), float(0))
    const refractedUv = screenUV.add(refractionOffset.mul(keepOffset))
    const sceneColor = viewportSharedTexture(refractedUv).rgb

    const baseColor = mix(this.deepColor, this.shallowColor, shallowMask)
    const attenuation = exp(this.absorption.mul(depthDelta.min(4)))
    const absorbed = mix(color('#064a61'), baseColor, attenuation)
    // Caustics belong on the submerged liner (see buildLinerMaterial), where
    // refraction naturally reveals them through the water. Adding the same
    // animated ridges here projected them onto the top plane as bright moving
    // streaks that read as rain.
    const refracted = mix(absorbed, sceneColor, this.refractionStrength)

    const shorelinePhase = shallowMask.oneMinus().mul(8)
      .sub(this.time.mul(this.shorelineSpeed).mul(0.35))
    const shorelineTexture = this.shorelineTextureNode
      .sample(this.worldWaterUv().mul(4).add(vec2(this.time.mul(0.01))))
      .r
    const shorelineBand = smoothstep(
      float(1).sub(this.shorelineWidth),
      float(1),
      shorelinePhase.sin().mul(0.5).add(0.5).mul(shorelineTexture),
    ).mul(shallowMask).mul(this.shorelineStrength)
    const intersectionBand = smoothstep(
      float(0.15),
      this.intersectionWidth.min(1.95).mul(0.45).add(0.15),
      shallowMask,
    ).mul(smoothstep(0.82, 1, shallowMask).oneMinus())
      .mul(this.intersectionStrength)

    const reflectedDirection = reflect(eye.negate(), surfaceNormal)
    const skyMix = smoothstep(-0.1, 0.8, reflectedDirection.y)
    const sky = mix(color('#d8eef9'), color('#1260a6'), skyMix)
    // Distort Pascal's opaque scene copy with the animated normal field. This
    // gives the water a moving screen-space reflection without a nested
    // reflector render, which is incompatible with the host's multisampled
    // WebGPU depth target.
    const reflectionOffset = mapped.xy
      .mul(this.normalStrength)
      .mul(this.reflectionDistortion.mul(0.035))
    const reflectedUv = screenUV.add(vec2(
      reflectionOffset.x.negate(),
      reflectionOffset.y,
    ))
    const nearbyScene = viewportSharedTexture(reflectedUv).rgb
    const reflectedScene = mix(sky, nearbyScene, 0.38)

    const fresnel = pow(float(1).sub(facing).max(1e-5), this.reflectionFresnel)
      .mul(this.reflectionStrength)

    const phong = pow(max(dot(reflectedDirection, this.sunDirection), 0), 96)
    const hardSpecular = smoothstep(
      float(1).sub(this.specularSize),
      float(1.15).sub(this.specularSize),
      phong,
    )
    const specular = mix(phong, hardSpecular, this.specularHardness)
      .mul(this.specularStrength)
      .mul(color('#fff8e7'))

    const layered = refracted
      .add(intersectionBand.mul(this.intersectionColor))
      .add(shorelineBand.mul(color('#f2ffff')))
    material.colorNode = mix(layered as any, reflectedScene as any, fresnel as any).add(specular as any) as any
    material.opacityNode = shoreFade
    return material
  }

  setSettings(settingsInput: Partial<WaterSettings>) {
    const previousPreset = this.settings.waterPreset
    this.settings = resolveWaterSettings(settingsInput)
    this.damping.value = this.computeDamping()
    this.simulationDetail.value = this.settings.surfaceDetail
    this.shallowColor.value.set(this.settings.shallowWaterColor)
    this.deepColor.value.set(this.settings.deepWaterColor)
    this.normalScale.value = this.settings.normalScale
    this.normalStrength.value = this.settings.normalStrength
    this.normalSpeed.value = this.settings.normalSpeed
    this.reflectionStrength.value = this.settings.reflectionStrength
    this.reflectionFresnel.value = this.settings.reflectionFresnel
    this.reflectionDistortion.value = this.settings.reflectionDistortion
    this.refractionStrength.value = this.settings.refractionStrength
    this.causticsStrength.value = this.settings.causticsStrength
    this.causticsScale.value = this.settings.causticsScale
    this.causticsSpeed.value = this.settings.causticsSpeed
    this.intersectionStrength.value = this.settings.intersectionStrength
    this.intersectionColor.value.set(this.settings.intersectionColor)
    this.intersectionWidth.value = this.settings.intersectionWidth
    this.shorelineStrength.value = this.settings.shorelineStrength
    this.shorelineWidth.value = this.settings.shorelineWidth
    this.shorelineSpeed.value = this.settings.shorelineSpeed
    this.specularStrength.value = this.settings.specularStrength
    this.specularSize.value = this.settings.specularSize
    this.specularHardness.value = this.settings.specularHardness
    this.absorption.value = -0.62 / this.settings.clarity
    this.updateSunDirection()
    if (previousPreset !== this.settings.waterPreset) {
      const selected = PRESET_TEXTURES[this.settings.waterPreset]
      this.normalTextureNode.value = loadWaterTexture(selected.normal)
      this.causticTextureNode.value = loadWaterTexture(selected.caustic)
      this.distortionTextureNode.value = loadWaterTexture(selected.distortion)
      this.shorelineTextureNode.value = loadWaterTexture(selected.shoreline)
    }
  }

  addDrop(u: number, v: number, radius?: number, strength = 0.055) {
    const normalizedRadius = (radius ?? this.settings.rippleSize / 1000) * 1.5
    this.drops.push([
      Math.max(0, Math.min(1, u)),
      Math.max(0, Math.min(1, v)),
      Math.max(0.004, normalizedRadius),
      strength,
    ])
  }

  splash() {
    this.addDrop(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6, 0.09, 0.22)
  }

  reset() {
    this.initialized = false
    this.drops.length = 0
  }

  private swap() {
    ;[this.read, this.write] = [this.write, this.read]
    this.inputNode.value = this.read.texture
    this.stateNode.value = this.read.texture
  }

  private pass(renderer: WebGPURenderer, material: NodeMaterial) {
    this.quad.material = material
    renderer.setRenderTarget(this.write)
    this.quad.render(renderer)
    this.swap()
  }

  update(renderer: WebGPURenderer, delta: number) {
    const previousTarget = renderer.getRenderTarget()
    const previousAutoClear = renderer.autoClear
    renderer.autoClear = true
    try {
      this.time.value += Math.min(delta, 0.05)
      if (!this.initialized) {
        this.pass(renderer, this.clearMaterial)
        this.pass(renderer, this.clearMaterial)
        this.initialized = true
      }

      this.rainAccumulator += delta * this.settings.rain * 48
      while (this.rainAccumulator >= 1) {
        this.rainAccumulator -= 1
        this.addDrop(Math.random(), Math.random(), 0.01 + Math.random() * 0.012, 0.025 + Math.random() * 0.04)
      }
      this.breezeAccumulator += delta * this.settings.breeze * 18
      while (this.breezeAccumulator >= 1) {
        this.breezeAccumulator -= 1
        this.addDrop(Math.random(), Math.random(), 0.05 + Math.random() * 0.08, (Math.random() - 0.5) * 0.012)
      }

      for (const [u, v, radius, strength] of this.drops.splice(0)) {
        this.dropCenter.value.set(u, v)
        this.dropRadius.value = radius
        this.dropStrength.value = strength
        this.pass(renderer, this.dropMaterial)
      }

      this.accumulator += Math.min(delta, 0.05)
      let steps = 0
      while (this.accumulator >= 1 / 60 && steps < 2) {
        this.pass(renderer, this.updateMaterial)
        this.pass(renderer, this.updateMaterial)
        this.accumulator -= 1 / 60
        steps += 1
      }
    } finally {
      renderer.setRenderTarget(previousTarget)
      renderer.autoClear = previousAutoClear
    }
  }

  dispose() {
    this.read.dispose()
    this.write.dispose()
    this.updateMaterial.dispose()
    this.dropMaterial.dispose()
    this.clearMaterial.dispose()
    this.material.dispose()
  }
}
