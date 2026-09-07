import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
} from 'three'

export const LOW_POLY_ROCK_PROFILES = [
  'boulder',
  'ledge',
  'pillar',
  'peak',
  'wedge',
  'shard',
] as const

export type LowPolyRockProfile = typeof LOW_POLY_ROCK_PROFILES[number]

type RingPoint = readonly [number, number, number]

type ProfileSettings = {
  sides: number
  lowerScale: number
  shoulderScale: number
  crownScale: number
  crownHeight: number
  topOffsetX: number
  topOffsetZ: number
}

const PROFILE_SETTINGS: Record<LowPolyRockProfile, ProfileSettings> = {
  boulder: { sides: 8, lowerScale: 1.03, shoulderScale: 0.94, crownScale: 0.5, crownHeight: 0.92, topOffsetX: 0.05, topOffsetZ: -0.03 },
  ledge: { sides: 7, lowerScale: 1.05, shoulderScale: 1, crownScale: 0.78, crownHeight: 0.82, topOffsetX: 0.12, topOffsetZ: 0 },
  pillar: { sides: 7, lowerScale: 0.9, shoulderScale: 0.82, crownScale: 0.48, crownHeight: 0.96, topOffsetX: -0.08, topOffsetZ: 0.04 },
  peak: { sides: 6, lowerScale: 1.02, shoulderScale: 0.78, crownScale: 0.2, crownHeight: 1.04, topOffsetX: 0.2, topOffsetZ: -0.1 },
  wedge: { sides: 7, lowerScale: 1.06, shoulderScale: 0.9, crownScale: 0.42, crownHeight: 0.92, topOffsetX: 0.28, topOffsetZ: 0.08 },
  shard: { sides: 5, lowerScale: 0.96, shoulderScale: 0.68, crownScale: 0.16, crownHeight: 1.08, topOffsetX: -0.22, topOffsetZ: 0.16 },
}

function seededRandom(seed: number) {
  let state = Math.abs(Math.trunc(seed)) || 1
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

function addTriangle(
  positions: number[],
  colors: number[],
  a: RingPoint,
  b: RingPoint,
  c: RingPoint,
  baseColor: Color,
  shade: number,
) {
  positions.push(...a, ...b, ...c)
  // Keep the faceted look legible under different scene lighting. The wider
  // value range gives each plane a distinct read without changing the rock's
  // shared base palette.
  const faceColor = baseColor.clone().offsetHSL(0, -0.025 + shade * 0.02, shade * 1.35)
  for (let index = 0; index < 3; index += 1) colors.push(faceColor.r, faceColor.g, faceColor.b)
}

/**
 * Builds a closed, faceted rock with a unique silhouette for each profile.
 * Every triangle owns its vertices so lighting keeps the hard low-poly planes.
 */
export function createLowPolyRockGeometry(
  width: number,
  height: number,
  depth: number,
  seed: number,
  profile: LowPolyRockProfile = profileForSeed(seed),
  color = '#8f8a80',
) {
  const random = seededRandom(seed)
  const settings = PROFILE_SETTINGS[profile]
  const sides = settings.sides
  const angleOffset = random() * Math.PI * 2
  const ringDefinitions = [
    { y: 0, scale: 0.82, centerX: 0, centerZ: 0 },
    { y: 0.16, scale: settings.lowerScale, centerX: (random() - 0.5) * 0.08, centerZ: (random() - 0.5) * 0.08 },
    { y: 0.62, scale: settings.shoulderScale, centerX: (random() - 0.5) * 0.13, centerZ: (random() - 0.5) * 0.13 },
    { y: settings.crownHeight, scale: settings.crownScale, centerX: settings.topOffsetX, centerZ: settings.topOffsetZ },
  ]
  const radialNoise = Array.from({ length: sides }, () => 0.76 + random() * 0.36)
  const angleNoise = Array.from({ length: sides }, () => (random() - 0.5) * 0.18)
  const rings: RingPoint[][] = ringDefinitions.map((ring, ringIndex) => {
    return Array.from({ length: sides }, (_, side) => {
      const angle = angleOffset + side / sides * Math.PI * 2 + angleNoise[side]!
      const ringVariation = 0.9 + random() * 0.2
      const wedgeScale = profile === 'wedge' && Math.cos(angle) < -0.15 ? 0.72 : 1
      const shardScale = profile === 'shard' && Math.sin(angle) > 0.2 ? 0.7 : 1
      const radius = radialNoise[side]! * ring.scale * ringVariation
      const yVariation = ringIndex === 0 ? 0 : (random() - 0.5) * 0.08
      return [
        (Math.cos(angle) * radius * wedgeScale + ring.centerX) * width * 0.5,
        (ring.y + yVariation) * height,
        (Math.sin(angle) * radius * shardScale + ring.centerZ) * depth * 0.5,
      ] as const
    })
  })
  const bottom: RingPoint = [0, -height * 0.035, 0]
  const top: RingPoint = [
    (settings.topOffsetX + (random() - 0.5) * 0.12) * width * 0.5,
    height,
    (settings.topOffsetZ + (random() - 0.5) * 0.12) * depth * 0.5,
  ]
  const positions: number[] = []
  const colors: number[] = []
  const baseColor = new Color(color)

  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides
    addTriangle(positions, colors, bottom, rings[0]![next]!, rings[0]![side]!, baseColor, -0.1 + random() * 0.04)
    for (let ring = 0; ring < rings.length - 1; ring += 1) {
      const a = rings[ring]![side]!
      const b = rings[ring]![next]!
      const c = rings[ring + 1]![side]!
      const d = rings[ring + 1]![next]!
      const shade = -0.08 + random() * 0.18
      if ((side + ring + Math.trunc(seed)) % 2 === 0) {
        addTriangle(positions, colors, a, c, b, baseColor, shade)
        addTriangle(positions, colors, b, c, d, baseColor, shade + (random() - 0.5) * 0.08)
      } else {
        addTriangle(positions, colors, a, c, d, baseColor, shade)
        addTriangle(positions, colors, a, d, b, baseColor, shade + (random() - 0.5) * 0.08)
      }
    }
    addTriangle(positions, colors, rings.at(-1)![side]!, top, rings.at(-1)![next]!, baseColor, 0.06 + random() * 0.12)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData.rockProfile = profile
  geometry.userData.seed = seed
  return geometry
}

export function createLowPolyRockMesh(
  width: number,
  height: number,
  depth: number,
  seed: number,
  color: string,
  profile: LowPolyRockProfile = profileForSeed(seed),
  roughness = 0.96,
) {
  const geometry = createLowPolyRockGeometry(width, height, depth, seed, profile, color)
  const material = new MeshStandardMaterial({
    color: '#ffffff',
    roughness,
    metalness: 0,
    flatShading: true,
    vertexColors: true,
  })
  const mesh = new Mesh(geometry, material)
  mesh.name = `waterfall-rock-${profile}`
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.rockProfile = profile
  mesh.userData.seed = seed
  return mesh
}

function profileForSeed(seed: number): LowPolyRockProfile {
  return LOW_POLY_ROCK_PROFILES[Math.abs(Math.trunc(seed)) % LOW_POLY_ROCK_PROFILES.length]!
}
