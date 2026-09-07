import type { AnyNode } from '@pascal-app/core'
import type { PoolNode, PoolPoint } from '../core/schema'

type ConnectionNode = AnyNode & {
  poolIds?: unknown
  sourcePoolId?: unknown
  targetPoolId?: unknown
}

const RIPPLE_SURFACES = new Set([
  'pool-shell-floor',
  'pool-entry-steps',
  'pool-entry-tanning-shelf',
  'pool-entry-beach',
  'pool-bench',
])

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

export function countPools(nodes: Record<string, AnyNode>) {
  let count = 0
  for (const node of Object.values(nodes)) {
    if (String(node.type) === 'pool:pool' && node.visible !== false) count += 1
  }
  return count
}

/** Water cost drops in steps, so adding a pool only rebuilds existing pools at a threshold. */
export function getPoolWaterResolution(visiblePoolCount: number) {
  if (visiblePoolCount <= 2) return 256
  if (visiblePoolCount <= 8) return 128
  return 64
}

/**
 * Water uniforms update in place. This signature contains only properties
 * that require a new Three.js mesh or a different water elevation.
 */
export function getPoolGeometrySignature(node: PoolNode) {
  return JSON.stringify({
    parentId: node.parentId,
    position: node.position,
    rotation: node.rotation,
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
  })
}

export function getPoolRippleUv(
  objectName: string,
  localPoint: PoolPoint,
  polygon: readonly PoolPoint[],
): [number, number] | null {
  if (!RIPPLE_SURFACES.has(objectName) || polygon.length < 3) return null
  let minimumX = Number.POSITIVE_INFINITY
  let maximumX = Number.NEGATIVE_INFINITY
  let minimumZ = Number.POSITIVE_INFINITY
  let maximumZ = Number.NEGATIVE_INFINITY
  for (const [x, z] of polygon) {
    minimumX = Math.min(minimumX, x)
    maximumX = Math.max(maximumX, x)
    minimumZ = Math.min(minimumZ, z)
    maximumZ = Math.max(maximumZ, z)
  }
  const width = maximumX - minimumX
  const depth = maximumZ - minimumZ
  if (width <= 0 || depth <= 0) return null
  return [
    Math.max(0, Math.min(1, (localPoint[0] - minimumX) / width)),
    Math.max(0, Math.min(1, (localPoint[1] - minimumZ) / depth)),
  ]
}
