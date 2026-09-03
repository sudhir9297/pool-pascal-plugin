import { DataTexture, DoubleSide, LinearFilter, MeshBasicNodeMaterial, NoColorSpace, RGBAFormat, RepeatWrapping, UnsignedByteType } from 'three/webgpu'
import {
  cameraFar,
  cameraNear,
  cameraPosition,
  color,
  dot,
  float,
  mix,
  normalLocal,
  normalize,
  perspectiveDepthToViewZ,
  positionView,
  positionWorld,
  pow,
  reflect,
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
  viewportSharedTexture,
} from 'three/tsl'
import {
  AdditiveBlending,
  Color,
  DoubleSide as ThreeDoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  MeshPhysicalMaterial,
  Object3D,
  SphereGeometry,
  TextureLoader,
  type Texture,
} from 'three'
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
  normal1: new URL('./assets/water/normal1.png', import.meta.url).href,
  normal2: new URL('./assets/water/normal2.png', import.meta.url).href,
  normal3: new URL('./assets/water/normal3.png', import.meta.url).href,
} as const
const WATERFALL_PRESET_TEXTURES: Record<WaterPreset, {
  mask: keyof typeof NOISE_URLS
  detail: keyof typeof NOISE_URLS
  normal: keyof typeof NOISE_URLS
}> = {
  'crystal-clear': { mask: 'caustic1', detail: 'noise5', normal: 'normal1' },
  'vivid-aqua': { mask: 'caustic2', detail: 'noise1', normal: 'normal3' },
  'tropical-lagoon': { mask: 'caustic1', detail: 'noise4', normal: 'normal2' },
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
    const normalTexture = texture(loadNoise(NOISE_URLS[selected.normal]))
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
    const normalScale = Math.max(0.5, settings.normalScale / 2.5)
    const normalA = normalTexture.sample(
      vec2(coordinates.x.mul(normalScale).add(time.mul(0.22)), coordinates.y.mul(normalScale * 0.48).add(time.mul(-0.5))),
    ).rgb
    const normalB = normalTexture.sample(
      vec2(coordinates.x.mul(normalScale * 1.7).sub(time.mul(0.14)), coordinates.y.mul(normalScale * 0.72).add(time.mul(-0.82))),
    ).rgb
    const flowNormal = normalize(vec3(
      normalA.r.add(normalB.r).sub(1).mul(settings.normalStrength * 0.42),
      1,
      normalA.g.add(normalB.g).sub(1).mul(settings.normalStrength * 0.42),
    ))

    const primaryScale = Math.max(1.35, settings.causticsScale * 0.72)
    const secondaryScale = Math.max(2.1, settings.causticsScale * 1.08)
    const maskA = maskTexture.sample(vec2(distortedX, slowFlow).mul(primaryScale)).g.min(0.3)
    const maskB = maskTexture.sample(
      vec2(distortedX, flow).mul(secondaryScale).add(vec2(1.7)),
    ).g.min(0.3)
    const broadFlow = detailNoise.sample(
      vec2(distortedX.mul(0.72), flow.mul(0.58)).mul(1.35 * detailScale),
    ).r
    const streakNoise = maskTexture.sample(
      vec2(distortedX.mul(3.8), fastFlow.mul(1.55)).mul(1.15 * detailScale),
    ).r
    const streaks = smoothstep(0.58, 0.92, streakNoise)
    const filaments = smoothstep(
      0.62,
      0.96,
      detailNoise.sample(vec2(distortedX.mul(8.5), flow.mul(0.82))).g,
    )
    const pattern = maskA.add(maskB).add(broadFlow.mul(0.22))

    // The authored curve changes its normal from up to forward. This is the
    // same signal the reference uses to grow turbulent foam over the lip.
    const noise = detailNoise.sample(vec2(distortedX.mul(1.5 * detailScale), fastFlow.mul(0.2)))
    const upward = smoothstep(0.1, 1, normalLocal.y)
    const edgeDistance = coordinates.x.min(coordinates.x.oneMinus())
    const edgeBreakup = smoothstep(0.02, 0.16, edgeDistance)
    const bottomZone = smoothstep(0.72, 1, coordinates.y)
    const bottomNoise = detailNoise.sample(
      vec2(distortedX.mul(4.6), fastFlow.mul(0.34).add(time.mul(0.2))),
    ).r
    const raggedThreshold = float(0.9).add(bottomNoise.sub(0.5).mul(0.16))
    const raggedBody = smoothstep(
      raggedThreshold.sub(0.025),
      raggedThreshold.add(0.025),
      coordinates.y,
    ).oneMinus()
    const lowerFilaments = smoothstep(0.7, 0.93, streakNoise)
      .mul(bottomZone)
      .mul(edgeBreakup)
    const silhouette = mix(
      edgeBreakup,
      raggedBody.mul(edgeBreakup).max(lowerFilaments),
      bottomZone,
    )
    const foamInput = noise.g.add(normalLocal.y).sub(0.1)
    const foamStart = smoothstep(0.3, 0.4, foamInput)
    const foamEnd = smoothstep(foamInput, foamInput.add(0.1), float(0.99))
    const fallFoam = foamStart.oneMinus().min(0.2).add(foamStart.mul(foamEnd))

    const material = new MeshBasicNodeMaterial({
      color: settings.shallowWaterColor,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
      alphaTest: 0.08,
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
    const vertical = upward.oneMinus()
    const poolLikeBlend = upward.mul(0.58).add(depth.mul(0.42)).min(1)
    const darkWater = this.deepColor.mul(0.3 + 0.1 / clarity)
    const litWater = mix(darkWater, this.shallowColor.mul(0.92), poolLikeBlend)
    const eye = normalize(cameraPosition.sub(positionWorld))
    const facing = dot(flowNormal, eye).max(0)
    const refractOffset = flowNormal.xz
      .mul(settings.refractionStrength * 0.018)
      .mul(1 + settings.reflectionDistortion * 0.35)
    const refractedScene = viewportSharedTexture(screenUV.add(refractOffset).clamp(0, 1)).rgb
    const reflectedDirection = reflect(eye.negate(), flowNormal)
    const sky = mix(color('#d8eef9'), color('#1260a6'), smoothstep(-0.1, 0.8, reflectedDirection.y))
    const reflectedScene = viewportSharedTexture(screenUV.add(refractOffset.mul(1.7)).clamp(0, 1)).rgb
    const reflection = mix(sky, reflectedScene, 0.42)
    const fresnel = pow(float(1).sub(facing).max(0.001), Math.max(1, settings.reflectionFresnel))
      .mul(Math.min(1.2, settings.reflectionStrength))
    const poolSurface = mix(litWater, refractedScene, Math.min(0.35, settings.refractionStrength * 0.28))
    const reflectiveWater = mix(poolSurface, reflection, fresnel.min(0.42))
    const patternGain = 0.72 + Math.min(4, settings.causticsStrength) * 0.08
    const foamGain = 0.78 + settings.shorelineStrength * 0.18 + settings.normalStrength * 0.07
    const crest = smoothstep(0.48, 0.94, upward)
      .mul(smoothstep(0.46, 0.94, broadFlow))
    const verticalHighlight = streaks.mul(vertical).mul(0.78)
    const brokenEdges = filaments.mul(edgeBreakup.oneMinus()).mul(vertical).mul(0.62)
    const brightness = pattern.mul(patternGain)
      .add(verticalHighlight)
      .add(brokenEdges)
      .add(crest.mul(0.34))
      .add(fallFoam.mul(foamGain))
      .add(brokenContact.max(0.5).sub(0.5))
    const foamColor = mix(this.shallowColor, color('#f2fdff'), 0.86)
    const sparkle = smoothstep(0.9, 0.99, streakNoise).mul(vertical).mul(settings.specularStrength * 0.18)
    material.colorNode = reflectiveWater.add(foamColor.mul(vec3(brightness.add(sparkle))))
    material.opacityNode = float(Math.min(0.92, 0.62 + settings.clarity * 0.09))
      .add(crest.mul(0.08))
      .add(verticalHighlight.mul(0.06))
      .mul(silhouette)
    this.material = material
  }

  update(delta: number) {
    this.time.value += Math.min(delta, 0.05)
  }

  dispose() {
    this.material.dispose()
  }
}

/** Crisp animated strands layered over the refractive waterfall body. */
export class WaterfallLineEffect {
  readonly material: MeshBasicNodeMaterial
  private readonly time = uniform(0)

  constructor(styleInput: Partial<WaterfallWaterStyle>, flowStrength = 1) {
    const settings = resolveWaterfallStyle(styleInput)
    const selected = WATERFALL_PRESET_TEXTURES[settings.waterPreset]
    const detailNoise = texture(loadNoise(NOISE_URLS[selected.detail]))
    const coordinates = uv()
    const speed = Math.max(0.2, Math.min(2, flowStrength))
    const randomField = detailNoise.sample(
      vec2(coordinates.x.mul(3.1), coordinates.y.mul(0.24).sub(this.time.mul(0.045 * speed))),
    ).r
    const warpedX = coordinates.x
      .add(randomField.sub(0.5).mul(0.026))
      .add(sin(coordinates.y.mul(19).sub(this.time.mul(0.85 * speed))).mul(0.006))
    const stripeA = sin(warpedX.mul(74).add(randomField.mul(7.2)))
      .mul(0.5).add(0.5)
    const stripeB = sin(warpedX.mul(113).add(randomField.mul(-10.5)).add(1.7))
      .mul(0.5).add(0.5)
    const randomGate = smoothstep(
      0.46,
      0.72,
      detailNoise.sample(vec2(warpedX.mul(5.7), coordinates.y.mul(0.3).add(2.4))).g,
    )
    const thinLines = smoothstep(0.84, 0.98, stripeA)
      .max(smoothstep(0.91, 0.992, stripeB).mul(0.58))
      .mul(randomGate.mul(0.78).add(0.22))
    const downwardPulse = sin(
      coordinates.y.mul(54)
        .sub(this.time.mul(13 * speed))
        .add(warpedX.mul(19)),
    ).mul(0.5).add(0.5)
    const brokenLength = smoothstep(0.08, 0.82, downwardPulse).mul(0.62).add(0.24)
    const verticalSurface = smoothstep(0.14, 0.72, normalLocal.y.abs().oneMinus())
    const edgeDistance = coordinates.x.min(coordinates.x.oneMinus())
    const edgeFade = smoothstep(0.01, 0.055, edgeDistance)
    const lowerStrength = smoothstep(0.2, 1, coordinates.y).mul(0.3).add(0.7)

    this.material = new MeshBasicNodeMaterial({
      color: settings.shallowWaterColor,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
      alphaTest: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
    this.material.colorNode = mix(color(settings.shallowWaterColor), color('#f4ffff'), 0.78)
    this.material.opacityNode = thinLines
      .mul(brokenLength)
      .mul(verticalSurface)
      .mul(edgeFade)
      .mul(lowerStrength)
      .mul(0.46)
  }

  update(delta: number) {
    this.time.value += Math.min(delta, 0.05)
  }

  dispose() {
    this.material.dispose()
  }
}

export type WaterfallBubbleFamily = 'foam' | 'aeration' | 'microstream'

type BubbleParticle = {
  x: number
  surfaceY: number
  z: number
  radius: number
  phase: number
  driftX: number
  driftZ: number
  shapeX: number
  shapeY: number
  shapeZ: number
  wobble: number
  frequency: number
  speedJitter: number
  tint: number
}

/** Batched surface bubbles with a dense impact layer and fine aeration. */
export class WaterfallBubbleCloudEffect {
  readonly material: MeshPhysicalMaterial
  readonly mesh: InstancedMesh
  private readonly particles: BubbleParticle[] = []
  private readonly transform = new Object3D()
  private readonly family: WaterfallBubbleFamily
  private readonly speed: number
  private time = 0

  constructor(
    styleInput: Partial<WaterfallWaterStyle>,
    flowStrength: number,
    family: WaterfallBubbleFamily,
    capacity: number,
  ) {
    const settings = resolveWaterfallStyle(styleInput)
    this.family = family
    this.speed = 0.32 + Math.max(0.2, Math.min(2, flowStrength)) * 0.16
    const isFoam = family === 'foam'
    const isStream = family === 'microstream'
    this.material = new MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: isFoam ? 0.09 : 0.045,
      metalness: 0,
      transparent: true,
      opacity: isFoam ? 0.3 : isStream ? 0.22 : 0.14,
      depthWrite: false,
      side: ThreeDoubleSide,
      transmission: isFoam ? 0.76 : 0.82,
      thickness: isFoam ? 0.018 : 0.01,
      ior: 1.08,
      clearcoat: 1,
      clearcoatRoughness: isFoam ? 0.055 : 0.025,
      specularIntensity: 1,
      attenuationColor: new Color(settings.shallowWaterColor).lerp(new Color('#ffffff'), 0.35),
      attenuationDistance: 0.35,
    })
    const segments = isFoam ? 10 : isStream ? 7 : 8
    const rings = isFoam ? 8 : 6
    this.mesh = new InstancedMesh(new SphereGeometry(1, segments, rings), this.material, capacity)
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    this.mesh.count = 0
    this.mesh.frustumCulled = false
  }

  addParticle(particle: BubbleParticle) {
    if (this.particles.length >= this.mesh.instanceMatrix.count) return
    const index = this.particles.length
    this.particles.push(particle)
    const poolTint = new Color('#72dce8')
    const white = new Color('#ffffff')
    const tintStrength = this.family === 'foam' ? 0.58 : this.family === 'microstream' ? 0.34 : 0.2
    this.mesh.setColorAt(index, poolTint.lerp(white, Math.min(1, tintStrength + particle.tint * 0.18)))
    this.mesh.count = this.particles.length
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  update(delta: number) {
    this.time += Math.min(delta, 0.05)
    for (const [index, particle] of this.particles.entries()) {
      const familySpeed = this.family === 'foam' ? 0.74 : this.family === 'microstream' ? 1.28 : 1
      const life = (this.time * this.speed * familySpeed * particle.speedJitter + particle.phase) % 1
      const envelopePower = this.family === 'foam' ? 0.48 : this.family === 'microstream' ? 0.92 : 0.72
      const envelope = Math.pow(Math.sin(life * Math.PI), envelopePower)
      const churn = 0.92 + Math.sin(this.time * 2.7 + particle.phase * 17) * 0.08
      const scale = Math.max(0.001, particle.radius * envelope * churn)
      const wobble = Math.sin(this.time * particle.frequency + particle.phase * 23)
        * particle.wobble * Math.sin(life * Math.PI)
      const asymmetricX = 0.9 + Math.sin(life * Math.PI) * 0.18
      const asymmetricY = 0.92 + Math.sin(life * Math.PI * 2 + particle.phase * 7) * 0.08
      const verticalScale = scale * particle.shapeY * asymmetricY
      const surfaceOffset = this.family === 'foam'
        ? verticalScale * 0.72
        : this.family === 'aeration'
          ? verticalScale * 0.12
          : verticalScale * -0.12
      const bob = Math.sin(this.time * 1.8 + particle.phase * 13) * verticalScale * 0.06
      this.transform.position.set(
        particle.x + particle.driftX * life + wobble,
        particle.surfaceY + surfaceOffset + bob,
        particle.z + particle.driftZ * life + wobble * 0.38,
      )
      this.transform.scale.set(
        scale * particle.shapeX * asymmetricX,
        verticalScale,
        scale * particle.shapeZ,
      )
      this.transform.rotation.set(
        wobble * 0.8,
        this.time * (0.12 + particle.phase * 0.18),
        Math.sin(this.time * 0.7 + particle.phase * 9) * 0.07,
      )
      this.transform.updateMatrix()
      this.mesh.setMatrixAt(index, this.transform.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
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
