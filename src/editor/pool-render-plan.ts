import type { AnyNode } from '@pascal-app/core'
import { resolvePoolPolygon, type PoolNode } from '../core/schema'
import { getPoolDepthRange } from '../design/depth-profile'
import { Euler, Quaternion, Vector3 } from 'three'

type ConnectionNode = AnyNode & {
  poolIds?: unknown
  sourcePoolId?: unknown
  targetPoolId?: unknown
}

type PoolConnectionIndex = {
  pipesByPool: Map<string, AnyNode[]>
}

const poolConnectionIndices = new WeakMap<object, PoolConnectionIndex>()

function poolConnectionIndex(nodes: Record<string, AnyNode>) {
  const cached = poolConnectionIndices.get(nodes)
  if (cached) return cached

  const pipesByPool = new Map<string, AnyNode[]>()
  for (const node of Object.values(nodes)) {
    if (node.type !== 'pipe-segment' && node.type !== 'pipe-fitting') continue
    const connection = (node as AnyNode & {
      metadata?: { poolConnection?: { poolId?: string } }
    }).metadata?.poolConnection
    if (!connection?.poolId) continue
    const pipes = pipesByPool.get(connection.poolId) ?? []
    pipes.push(node)
    pipesByPool.set(connection.poolId, pipes)
  }

  const index = { pipesByPool }
  poolConnectionIndices.set(nodes, index)
  return index
}

function connectionTouchesPool(node: AnyNode, poolId: string) {
  const candidate = node as ConnectionNode
  if (String(candidate.type) === 'pool:spillover') {
    return candidate.sourcePoolId === poolId || candidate.targetPoolId === poolId
  }
  return String(candidate.type) === 'pool:shared-joint'
    && Array.isArray(candidate.poolIds)
    && candidate.poolIds.includes(poolId)
}

/**
 * Returns only nodes whose identity can change this pool's generated mesh.
 * Object references are preserved so a shallow selector ignores unrelated
 * scene edits.
 */
export function selectPoolRenderNodes(
  nodes: Record<string, AnyNode>,
  poolId: string,
): AnyNode[] {
  const connections = Object.values(nodes).filter((node) => connectionTouchesPool(node, poolId))
  const relatedPoolIds = new Set<string>()
  for (const node of connections) {
    const candidate = node as ConnectionNode
    if (String(candidate.type) === 'pool:spillover') {
      if (typeof candidate.sourcePoolId === 'string') relatedPoolIds.add(candidate.sourcePoolId)
      if (typeof candidate.targetPoolId === 'string') relatedPoolIds.add(candidate.targetPoolId)
    }
  }
  relatedPoolIds.delete(poolId)

  const connectionIds = new Set(connections.map((node) => node.id))
  return Object.values(nodes).filter((node) =>
    connectionIds.has(node.id)
    || (String(node.type) === 'pool:pool' && relatedPoolIds.has(node.id)),
  )
}

/** Returns pipe members explicitly owned by this pool's generated connection. */
export function selectPoolConnectedPipes(
  nodes: Record<string, AnyNode>,
  poolId: string,
) {
  return poolConnectionIndex(nodes).pipesByPool.get(poolId) ?? []
}

export function countPools(nodes: Record<string, AnyNode>) {
  let count = 0
  for (const node of Object.values(nodes)) {
    if (String(node.type) === 'pool:pool' && node.visible !== false) count += 1
  }
  return count
}

/** Water cost drops in steps, so adding a pool only rebuilds existing pools at a threshold. */
export function getPoolWaterResolution(
  visiblePoolCount: number,
  quality: PoolNode['waterQuality'] = 'high',
) {
  const qualityLimit = { low: 64, medium: 128, high: 256, ultra: 384 }[quality]
  const sceneLimit = visiblePoolCount <= 2 ? 384 : visiblePoolCount <= 8 ? 128 : 64
  return Math.min(qualityLimit, sceneLimit)
}

/** Fields that affect the existing water effect's uniforms or textures. */
export function getPoolWaterSettingsSignature(node: PoolNode) {
  return JSON.stringify({
    waterPreset: node.waterPreset,
    waterQuality: node.waterQuality,
    shallowWaterColor: node.shallowWaterColor,
    deepWaterColor: node.deepWaterColor,
    waterColor: node.waterColor,
    surfaceDetail: node.surfaceDetail,
    viscosity: node.viscosity,
    rippleSize: node.rippleSize,
    clarity: node.clarity,
    rain: node.rain,
    breeze: node.breeze,
    normalScale: node.normalScale,
    normalStrength: node.normalStrength,
    normalSpeed: node.normalSpeed,
    reflectionStrength: node.reflectionStrength,
    reflectionFresnel: node.reflectionFresnel,
    reflectionDistortion: node.reflectionDistortion,
    refractionStrength: node.refractionStrength,
    causticsStrength: node.causticsStrength,
    causticsScale: node.causticsScale,
    causticsSpeed: node.causticsSpeed,
    intersectionStrength: node.intersectionStrength,
    intersectionColor: node.intersectionColor,
    intersectionWidth: node.intersectionWidth,
    shorelineStrength: node.shorelineStrength,
    shorelineWidth: node.shorelineWidth,
    shorelineSpeed: node.shorelineSpeed,
    specularStrength: node.specularStrength,
    specularSize: node.specularSize,
    specularHardness: node.specularHardness,
    sunElevation: node.sunElevation,
    sunAzimuth: node.sunAzimuth,
    waterMode: node.waterMode,
  })
}

function polygonBounds(node: PoolNode) {
  const points = resolvePoolPolygon(node)
  const xs = points.map(([x]) => x)
  const zs = points.map(([, z]) => z)
  return {
    centerX: (Math.min(...xs) + Math.max(...xs)) / 2,
    centerZ: (Math.min(...zs) + Math.max(...zs)) / 2,
    length: Math.max(...xs) - Math.min(...xs),
    width: Math.max(...zs) - Math.min(...zs),
  }
}

/** Reuses the committed basin mesh while a horizontal resize is in flight. */
export function getPoolResizePreviewTransform(committed: PoolNode, preview: PoolNode) {
  const source = polygonBounds(committed)
  const target = polygonBounds(preview)
  const scaleX = target.length / Math.max(source.length, Number.EPSILON)
  const scaleZ = target.width / Math.max(source.width, Number.EPSILON)
  return {
    position: [
      target.centerX - source.centerX * scaleX,
      0,
      target.centerZ - source.centerZ * scaleZ,
    ] as [number, number, number],
    scale: [scaleX, 1, scaleZ] as [number, number, number],
  }
}

/** Applies the horizontal pool resize preview to a direct generic child. */
export function getPoolChildResizePreviewPosition(
  committed: PoolNode,
  preview: PoolNode,
  position: readonly [number, number, number],
) {
  const transform = getPoolResizePreviewTransform(committed, preview)
  return [
    transform.position[0] + position[0] * transform.scale[0],
    position[1],
    transform.position[2] + position[2] * transform.scale[2],
  ] as [number, number, number]
}

/** Maps a level-local point through a pool's horizontal resize preview. */
export function getPoolLevelResizePreviewPosition(
  committed: PoolNode,
  preview: PoolNode,
  position: readonly [number, number, number],
) {
  const local = new Vector3(...position)
    .sub(new Vector3(...committed.position))
    .applyQuaternion(new Quaternion().setFromEuler(new Euler(...committed.rotation)).invert())
  const resized = getPoolChildResizePreviewPosition(committed, preview, local.toArray() as [number, number, number])
  return new Vector3(...resized)
    .applyQuaternion(new Quaternion().setFromEuler(new Euler(...committed.rotation)))
    .add(new Vector3(...committed.position))
    .toArray() as [number, number, number]
}

export function getPoolLevelResizePreviewPath(
  committed: PoolNode,
  preview: PoolNode,
  path: readonly (readonly [number, number, number])[],
) {
  return path.map((point) => getPoolLevelResizePreviewPosition(committed, preview, point))
}

/** Reuses the committed basin mesh while the depth handle is moving. */
export function getPoolDepthResizePreviewTransform(committed: PoolNode, preview: PoolNode) {
  const sourceDepth = getPoolDepthRange(committed).maximum
  const targetDepth = getPoolDepthRange(preview).maximum
  const scaleY = targetDepth / Math.max(sourceDepth, Number.EPSILON)
  return {
    position: [0, preview.finishedDeckElevation * (1 - scaleY), 0] as [number, number, number],
    scale: [1, Math.min(4, Math.max(0.25, scaleY)), 1] as [number, number, number],
  }
}

/**
 * Water uniforms update in place. This signature contains only properties
 * that require a new Three.js mesh or a different water elevation.
 */
export function getPoolGeometrySignature(node: PoolNode) {
  return JSON.stringify({
    shape: node.shape,
    length: node.length,
    width: node.width,
    polygon: node.polygon,
    outlineControlPoints: node.outlineControlPoints,
    floorProfile: node.floorProfile,
    depth: node.depth,
    shallowDepth: node.shallowDepth,
    deepDepth: node.deepDepth,
    slopeStart: node.slopeStart,
    slopeEnd: node.slopeEnd,
    coveRadius: node.coveRadius,
    entryFeature: node.entryFeature,
    entryLength: node.entryLength,
    entryWaterDepth: node.entryWaterDepth,
    stepCount: node.stepCount,
    benchEnabled: node.benchEnabled,
    benchStyle: node.benchStyle,
    benchWall: node.benchWall,
    benchBoundaryT: node.benchBoundaryT,
    benchLength: node.benchLength,
    benchWidth: node.benchWidth,
    benchWaterDepth: node.benchWaterDepth,
    copingWidth: node.copingWidth,
    copingThickness: node.copingThickness,
    copingStyle: node.copingStyle,
    copingStoneLength: node.copingStoneLength,
    copingJointWidth: node.copingJointWidth,
    copingIrregularity: node.copingIrregularity,
    copingSeed: node.copingSeed,
    copingColor: node.copingColor,
    copingProfile: node.copingProfile,
    copingCorner: node.copingCorner,
    shellThickness: node.shellThickness,
    floorThickness: node.floorThickness,
    openingClearance: node.openingClearance,
    finishedDeckElevation: node.finishedDeckElevation,
    designWaterElevation: node.designWaterElevation,
    interiorFinish: node.interiorFinish,
    // Quality changes both simulation resolution and the compiled screen-space
    // reflection/refraction graph, so it intentionally rebuilds the material.
    waterQuality: node.waterQuality,
  })
}
