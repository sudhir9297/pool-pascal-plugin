import {
  type AnyNode,
  type AnyNodeId,
  type PolygonPoint2D,
  SlabNode as SlabNodeSchema,
  type SlabNode,
  polygonContainsPolygon,
} from '@pascal-app/core'
import { type PoolNode, resolvePoolPolygon } from '../core/schema'
import { PoolSharedJointNode } from '../shared-joint/core/schema'
import { PoolSpilloverNode } from '../spillover/core/schema'
import { buildPoolOutlines, outsetPoolPolygon } from './outlines'

export { outsetPoolPolygon as outsetPolygon } from './outlines'

type ExistingHoleMetadata = SlabNode['holeMetadata'][number]

export type PoolOpeningUpdate = {
  id: AnyNodeId
  data: {
    holes: PolygonPoint2D[][]
    holeMetadata: ExistingHoleMetadata[]
    metadata: SlabNode['metadata']
  }
}

export type PoolGroundOpeningChanges = {
  create: SlabNode[]
  update: Array<{ id: AnyNodeId; data: Partial<SlabNode> }>
  delete: AnyNodeId[]
}

type PoolConnectionNode = PoolSharedJointNode | PoolSpilloverNode
type PoolSceneNode = AnyNode | PoolNode | PoolConnectionNode

const COORDINATE_PRECISION = 1e9
const GEOMETRY_TOLERANCE = 1e-7
// Keep helper-slab holes visibly clear of pool/spillover edges. A near-zero
// margin leaves coplanar side faces that flicker in the renderer.
const GROUND_OPENING_HOLE_MARGIN = 0.025
const GROUND_OPENING_METADATA_KEY = 'poolGroundOpeningFor'
const SLAB_OPENINGS_METADATA_KEY = 'poolManagedOpenings'

type ManagedPoolOpening = {
  poolId: string
  polygon: PolygonPoint2D[]
  holeIndex?: number
}

function poolGroundOpeningId(poolId: string): AnyNodeId {
  const suffix = poolId.startsWith('pool_') ? poolId.slice('pool_'.length) : poolId
  return `slab_pool-ground-${suffix}` as AnyNodeId
}

function connectionGroundOpeningId(connectionId: string): AnyNodeId {
  return `slab_pool-connection-ground-${connectionId.replace(/[^a-zA-Z0-9_-]/g, '_')}` as AnyNodeId
}

function poolGroundOpeningOwner(node: PoolSceneNode): string | null {
  if (node.type !== 'slab' || node.recessed !== true) return null
  const metadata = node.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const owner = (metadata as Record<string, unknown>)[GROUND_OPENING_METADATA_KEY]
  return typeof owner === 'string' ? owner : null
}

function connectionGroundOpeningOwner(node: PoolSceneNode): string | null {
  if (node.type !== 'slab' || node.recessed !== true) return null
  const metadata = node.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const owner = (metadata as Record<string, unknown>)[GROUND_OPENING_METADATA_KEY]
  return typeof owner === 'string' && owner.startsWith('pool-connection:') ? owner.slice('pool-connection:'.length) : null
}

function isPoolGroundOpeningSlab(node: PoolSceneNode): node is SlabNode {
  return poolGroundOpeningOwner(node) !== null
}

function roundCoordinate(value: number) {
  return Math.round(value * COORDINATE_PRECISION) / COORDINATE_PRECISION
}

export function getPoolOpeningPolygon(pool: PoolNode): PolygonPoint2D[] {
  const rotation = pool.rotation[1] ?? 0
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const localOpening = buildPoolOutlines(resolvePoolPolygon(pool), {
    shellThickness: pool.shellThickness,
    copingWidth: pool.copingWidth,
    coveRadius: pool.coveRadius,
    openingClearance: pool.openingClearance,
  }).constructionOpening
  return localOpening.map(([x, z]) => [
    roundCoordinate(pool.position[0] + x * cos + z * sin),
    roundCoordinate(pool.position[2] - x * sin + z * cos),
  ])
}

function transformPolygonToSiteCoordinates(
  polygon: PolygonPoint2D[],
  parentId: string | null,
  nodes: Record<string, PoolSceneNode>,
) {
  let transformed = polygon
  let ancestorId: string | null = parentId
  const visited = new Set<string>()

  while (ancestorId && !visited.has(ancestorId)) {
    visited.add(ancestorId)
    const ancestor = nodes[ancestorId]
    if (!ancestor || ancestor.type === 'site') break
    const candidate = ancestor as PoolSceneNode & {
      position?: [number, number, number]
      rotation?: [number, number, number]
    }
    const position = candidate.position ?? [0, 0, 0]
    const rotation = candidate.rotation?.[1] ?? 0
    if (position[0] !== 0 || position[2] !== 0 || rotation !== 0) {
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      transformed = transformed.map(([x, z]) => [
        roundCoordinate(position[0] + x * cos + z * sin),
        roundCoordinate(position[2] - x * sin + z * cos),
      ])
    }
    ancestorId = ancestor.parentId
  }

  return transformed
}

/** Finds the topmost solid slab that can safely contain a draft pool opening. */
export function findPoolHostSlabId(
  nodes: Record<string, PoolSceneNode>,
  levelId: string,
  polygon: PolygonPoint2D[],
  constructionOffset: number,
): string | null {
  const opening = outsetPoolPolygon(polygon, constructionOffset)
  const candidates = Object.values(nodes)
    .filter((node): node is SlabNode =>
      node.type === 'slab' &&
      node.parentId === levelId &&
      node.visible !== false &&
      (node as SlabNode & { recessed?: boolean }).recessed !== true &&
      polygonContainsPolygon(node.polygon, opening),
    )
    .sort((left, right) =>
      (right.elevation ?? 0) - (left.elevation ?? 0) || left.id.localeCompare(right.id),
    )
  return candidates[0]?.id ?? null
}

/** Converts level-local drawing points into a movable node-local outline. */
export function localizePoolPolygon(polygon: PolygonPoint2D[]): {
  polygon: PolygonPoint2D[]
  position: [number, number, number]
} {
  const xs = polygon.map(([x]) => x)
  const zs = polygon.map(([, z]) => z)
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2
  const centerZ = (Math.min(...zs) + Math.max(...zs)) / 2
  return {
    polygon: polygon.map(([x, z]) => [
      roundCoordinate(x - centerX),
      roundCoordinate(z - centerZ),
    ]),
    position: [roundCoordinate(centerX), 0, roundCoordinate(centerZ)],
  }
}

function pointsEqual(left: PolygonPoint2D, right: PolygonPoint2D) {
  return Math.hypot(left[0] - right[0], left[1] - right[1]) <= GEOMETRY_TOLERANCE
}

function polygonsEqual(left: PolygonPoint2D[][], right: PolygonPoint2D[][]) {
  return left.length === right.length && left.every((polygon, polygonIndex) => {
    const candidate = right[polygonIndex]
    return Boolean(candidate) && polygon.length === candidate?.length && polygon.every(
      (point, pointIndex) => Boolean(candidate?.[pointIndex]) && pointsEqual(point, candidate![pointIndex]!),
    )
  })
}

/**
 * Slab move/rotate tools transform the real hole polygons, but intentionally
 * leave opaque plugin metadata alone. Compare shape independently of its
 * location and orientation so a managed hole can still be reclaimed after
 * that rigid transform.
 */
function polygonsAreRigidlyCongruent(
  left: PolygonPoint2D[],
  right: PolygonPoint2D[],
) {
  if (left.length !== right.length) return false
  for (let start = 0; start < left.length; start += 1) {
    for (let end = start + 1; end < left.length; end += 1) {
      const leftStart = left[start]!
      const leftEnd = left[end]!
      const rightStart = right[start]!
      const rightEnd = right[end]!
      const leftDistance = Math.hypot(
        leftEnd[0] - leftStart[0],
        leftEnd[1] - leftStart[1],
      )
      const rightDistance = Math.hypot(
        rightEnd[0] - rightStart[0],
        rightEnd[1] - rightStart[1],
      )
      if (Math.abs(leftDistance - rightDistance) > GEOMETRY_TOLERANCE) return false
    }
  }
  return true
}

function findManagedHoleIndices(
  holes: PolygonPoint2D[][],
  managedOpenings: ManagedPoolOpening[],
) {
  const matched = new Set<number>()
  const tailStart = holes.length - managedOpenings.length

  managedOpenings.forEach((opening, managedIndex) => {
    const recordedIndex = opening.holeIndex
    const recordedHole = recordedIndex === undefined ? undefined : holes[recordedIndex]
    if (
      recordedIndex !== undefined &&
      !matched.has(recordedIndex) &&
      recordedHole &&
      polygonsAreRigidlyCongruent(opening.polygon, recordedHole)
    ) {
      matched.add(recordedIndex)
      return
    }

    // Pool holes are appended after every preserved manual/stair/elevator
    // hole. Prefer that stable slot when a slab transform made the stored
    // coordinates stale; this avoids stealing an identical manual hole.
    const expectedIndex = tailStart + managedIndex
    const expectedHole = holes[expectedIndex]
    if (
      expectedIndex >= 0 &&
      !matched.has(expectedIndex) &&
      expectedHole &&
      polygonsAreRigidlyCongruent(opening.polygon, expectedHole)
    ) {
      matched.add(expectedIndex)
      return
    }

    const exactIndex = holes.findIndex((hole, holeIndex) =>
      !matched.has(holeIndex) && polygonsEqual([opening.polygon], [hole]),
    )
    if (exactIndex >= 0) {
      matched.add(exactIndex)
      return
    }

    const congruent = holes
      .map((hole, holeIndex) => ({ hole, holeIndex }))
      .filter(({ hole, holeIndex }) =>
        !matched.has(holeIndex) && polygonsAreRigidlyCongruent(opening.polygon, hole),
      )
    // With no stable slot, only claim an unambiguous match. Preserving an
    // uncertain hole is safer than deleting user-authored geometry.
    if (congruent.length === 1) matched.add(congruent[0]!.holeIndex)
  })

  return matched
}

function metadataEqual(left: unknown[], right: ExistingHoleMetadata[]) {
  return left.length === right.length && left.every((metadata, index) => {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
    const entry = metadata as Record<string, unknown>
    const candidate = right[index]
    return entry.source === candidate?.source &&
      entry.stairId === (candidate && 'stairId' in candidate ? candidate.stairId : undefined) &&
      entry.elevatorId ===
        (candidate && 'elevatorId' in candidate ? candidate.elevatorId : undefined)
  })
}

function normalizeMetadata(slab: SlabNode): ExistingHoleMetadata[] {
  return slab.holes.map((_, index) => {
    const value = slab.holeMetadata[index] as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { source: 'manual' }
    }
    const entry = value as Record<string, unknown>
    if (entry.source === 'stair') {
      return {
        source: 'stair',
        ...(typeof entry.stairId === 'string' ? { stairId: entry.stairId } : {}),
      }
    }
    if (entry.source === 'elevator') {
      return {
        source: 'elevator',
        ...(typeof entry.elevatorId === 'string' ? { elevatorId: entry.elevatorId } : {}),
      }
    }
    return { source: 'manual' }
  })
}

function readManagedPoolOpenings(slab: SlabNode): ManagedPoolOpening[] {
  const metadata = slab.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
  const value = (metadata as Record<string, unknown>)[SLAB_OPENINGS_METADATA_KEY]
  if (!Array.isArray(value)) return []
  return value.flatMap((entry): ManagedPoolOpening[] => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const candidate = entry as Record<string, unknown>
    if (typeof candidate.poolId !== 'string' || !Array.isArray(candidate.polygon)) return []
    const polygon = candidate.polygon
    if (!polygon.every((point) =>
      Array.isArray(point) && point.length >= 2 &&
      Number.isFinite(point[0]) && Number.isFinite(point[1])
    )) return []
    return [{
      poolId: candidate.poolId,
      polygon: polygon.map((point) => [Number(point[0]), Number(point[1])]),
      ...(Number.isInteger(candidate.holeIndex) && Number(candidate.holeIndex) >= 0
        ? { holeIndex: Number(candidate.holeIndex) }
        : {}),
    }]
  })
}

function readLegacyPoolOpenings(slab: SlabNode): ManagedPoolOpening[] {
  return slab.holes.flatMap((polygon, index): ManagedPoolOpening[] => {
    const metadata = slab.holeMetadata[index] as unknown
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []
    const entry = metadata as Record<string, unknown>
    return entry.source === 'pool' && typeof entry.poolId === 'string'
      ? [{ poolId: entry.poolId, polygon }]
      : []
  })
}

function withManagedPoolOpeningsMetadata(
  slab: SlabNode,
  openings: ManagedPoolOpening[],
): SlabNode['metadata'] {
  const metadata = slab.metadata && typeof slab.metadata === 'object' && !Array.isArray(slab.metadata)
    ? { ...slab.metadata }
    : {}
  if (openings.length > 0) metadata[SLAB_OPENINGS_METADATA_KEY] = openings
  else delete metadata[SLAB_OPENINGS_METADATA_KEY]
  return metadata
}

function managedPoolOpeningsEqual(left: ManagedPoolOpening[], right: ManagedPoolOpening[]) {
  return left.length === right.length && left.every((opening, index) =>
    opening.poolId === right[index]?.poolId &&
    opening.holeIndex === right[index]?.holeIndex &&
    Boolean(right[index]) && polygonsEqual([opening.polygon], [right[index]!.polygon]),
  )
}

function buildPoolGroundOpeningSlab(
  pool: PoolNode,
  nodes: Record<string, PoolSceneNode>,
  id = poolGroundOpeningId(pool.id),
): SlabNode {
  const polygon = transformPolygonToSiteCoordinates(
    getPoolOpeningPolygon(pool),
    pool.parentId,
    nodes,
  )
  const clearingHole = outsetPoolPolygon(polygon, GROUND_OPENING_HOLE_MARGIN)
  return SlabNodeSchema.parse({
    id,
    name: `Ground opening for ${pool.name ?? pool.id}`,
    parentId: pool.parentId,
    visible: pool.visible !== false,
    metadata: { [GROUND_OPENING_METADATA_KEY]: pool.id },
    polygon,
    // The host uses the outer polygon to punch its site and horizon planes.
    // A slightly larger hole removes every face from this helper slab itself.
    holes: [clearingHole],
    holeMetadata: [{ source: 'manual' }],
    elevation: -0.02,
    recessed: true,
    recessedRimElevation: 0,
  })
}

function getConnectionOpeningPolygon(connection: PoolConnectionNode): PolygonPoint2D[] {
  const isSpillover = connection.type === 'pool:spillover'
  const clearance = isSpillover ? 0 : 0.04
  // Match the floor opening to the visible channel-wall footprint. The
  // side walls and outer borders end at width / 2, while their longitudinal
  // border extension is lipThickness + 0.02 on each end.
  const halfLength = connection.length / 2 + (isSpillover ? connection.lipThickness + 0.02 : clearance)
  const halfWidth = isSpillover
    ? (connection.effectiveWidth ?? connection.width) / 2
    : connection.width / 2 + clearance
  const rotation = connection.rotation[1] ?? 0
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const local: PolygonPoint2D[] = [[-halfLength, -halfWidth], [halfLength, -halfWidth], [halfLength, halfWidth], [-halfLength, halfWidth]]
  return local.map(([x, z]) => [
    roundCoordinate(connection.position[0] + x * cos + z * sin),
    roundCoordinate(connection.position[2] - x * sin + z * cos),
  ])
}

function buildConnectionGroundOpeningSlab(
  connection: PoolConnectionNode,
  nodes: Record<string, PoolSceneNode>,
  id = connectionGroundOpeningId(connection.id),
): SlabNode {
  const polygon = transformPolygonToSiteCoordinates(getConnectionOpeningPolygon(connection), connection.parentId, nodes)
  // Keep the helper slab's clearing hole slightly larger than its boundary.
  // Using the exact same polygon for both fields leaves a coplanar ring in
  // the site/slab triangulation, so the original floor can remain visible
  // across a separated-pool spillover gap. Pool-owned helpers already use
  // this pattern via `clearingHole` above.
  const clearingHole = outsetPoolPolygon(polygon, GROUND_OPENING_HOLE_MARGIN)
  return SlabNodeSchema.parse({
    id,
    name: `Ground opening for ${connection.name ?? connection.id}`,
    parentId: connection.parentId,
    visible: connection.visible !== false,
    metadata: { [GROUND_OPENING_METADATA_KEY]: `pool-connection:${connection.id}` },
    polygon,
    holes: [clearingHole],
    holeMetadata: [{ source: 'manual' }],
    elevation: -0.02,
    recessed: true,
    recessedRimElevation: 0,
  })
}

function groundOpeningSlabsEqual(left: SlabNode, right: SlabNode) {
  return left.parentId === right.parentId &&
    left.visible === right.visible &&
    left.name === right.name &&
    left.elevation === right.elevation &&
    left.recessed === right.recessed &&
    left.recessedRimElevation === right.recessedRimElevation &&
    polygonsEqual([left.polygon, ...(left.holes ?? [])], [right.polygon, ...right.holes])
}

/**
 * Mirrors every pool into a geometry-free recessed slab. Pascal's site renderer
 * treats visible recessed slabs on the ground level as holes in both its site
 * fill and its horizon/shadow receiver.
 */
export function syncPoolGroundOpenings(
  nodes: Record<string, PoolSceneNode>,
): PoolGroundOpeningChanges {
  const pools = Object.values(nodes)
    .filter((node): node is PoolNode => node.type === 'pool:pool')
    .sort((left, right) => left.id.localeCompare(right.id))
  const connections = Object.values(nodes)
    .flatMap((node) => {
      const parsed = PoolSharedJointNode.safeParse(node).success
        ? PoolSharedJointNode.safeParse(node)
        : PoolSpilloverNode.safeParse(node)
      return parsed.success ? [parsed.data] : []
    })
    .sort((left, right) => left.id.localeCompare(right.id))
  const helpersByOwner = new Map<string, SlabNode[]>()

  for (const node of Object.values(nodes)) {
    const owner = poolGroundOpeningOwner(node)
    const connectionOwner = connectionGroundOpeningOwner(node)
    const ownerKey = owner ?? connectionOwner
    if (!ownerKey) continue
    const helpers = helpersByOwner.get(ownerKey)
    if (helpers) helpers.push(node as SlabNode)
    else helpersByOwner.set(ownerKey, [node as SlabNode])
  }

  const create: SlabNode[] = []
  const update: Array<{ id: AnyNodeId; data: Partial<SlabNode> }> = []
  const staleHelpers: SlabNode[] = []
  for (const pool of pools) {
    const helpers = (helpersByOwner.get(pool.id) ?? [])
      .sort((left, right) => {
        const preferredId = poolGroundOpeningId(pool.id)
        if (left.id === preferredId) return -1
        if (right.id === preferredId) return 1
        return left.id.localeCompare(right.id)
      })
    const existing = helpers[0]
    if (!existing) {
      const baseId = poolGroundOpeningId(pool.id)
      let desiredId = baseId
      let suffix = 2
      while (nodes[desiredId] || create.some((node) => node.id === desiredId)) {
        desiredId = `${baseId}-${suffix}` as AnyNodeId
        suffix += 1
      }
      create.push(buildPoolGroundOpeningSlab(pool, nodes, desiredId))
      continue
    }
    helpersByOwner.delete(pool.id)
    staleHelpers.push(...helpers.slice(1))
    const desired = buildPoolGroundOpeningSlab(pool, nodes, existing.id as AnyNodeId)
    if (!groundOpeningSlabsEqual(existing, desired)) {
      update.push({
        id: existing.id as AnyNodeId,
        data: {
          name: desired.name,
          parentId: desired.parentId,
          visible: desired.visible,
          polygon: desired.polygon,
          holes: desired.holes,
          holeMetadata: desired.holeMetadata,
          elevation: desired.elevation,
          recessed: desired.recessed,
          recessedRimElevation: desired.recessedRimElevation,
        },
      })
    }
  }

  for (const connection of connections) {
    const owner = `pool-connection:${connection.id}`
    const helpers = (helpersByOwner.get(connection.id) ?? helpersByOwner.get(owner) ?? [])
      .sort((left, right) => left.id.localeCompare(right.id))
    const existing = helpers[0]
    if (!existing) {
      const baseId = connectionGroundOpeningId(connection.id)
      let desiredId = baseId
      let suffix = 2
      while (nodes[desiredId] || create.some((node) => node.id === desiredId)) {
        desiredId = `${baseId}-${suffix}` as AnyNodeId
        suffix += 1
      }
      create.push(buildConnectionGroundOpeningSlab(connection, nodes, desiredId))
      continue
    }
    helpersByOwner.delete(connection.id)
    helpersByOwner.delete(owner)
    staleHelpers.push(...helpers.slice(1))
    const desired = buildConnectionGroundOpeningSlab(connection, nodes, existing.id as AnyNodeId)
    if (!groundOpeningSlabsEqual(existing, desired)) {
      update.push({ id: existing.id as AnyNodeId, data: {
        name: desired.name,
        parentId: desired.parentId,
        visible: desired.visible,
        polygon: desired.polygon,
        holes: desired.holes,
        holeMetadata: desired.holeMetadata,
        elevation: desired.elevation,
        recessed: desired.recessed,
        recessedRimElevation: desired.recessedRimElevation,
      } })
    }
  }

  return {
    create,
    update,
    delete: [
      ...staleHelpers,
      ...[...helpersByOwner.values()].flat(),
    ].map((slab) => slab.id as AnyNodeId).sort(),
  }
}

/** Reconciles pool-owned holes without modifying manual, stair, or elevator openings. */
export function syncPoolSlabOpenings(
  nodes: Record<string, PoolSceneNode>,
): PoolOpeningUpdate[] {
  const pools = Object.values(nodes)
    .filter((node): node is PoolNode => node.type === 'pool:pool' && node.visible !== false)
    .sort((left, right) => left.id.localeCompare(right.id))
  const slabs = Object.values(nodes).filter(
    (node): node is SlabNode => node.type === 'slab' && !isPoolGroundOpeningSlab(node),
  )
  const connections = Object.values(nodes).flatMap((node) => {
    const parsed = PoolSharedJointNode.safeParse(node).success
      ? PoolSharedJointNode.safeParse(node)
      : PoolSpilloverNode.safeParse(node)
    return parsed.success && parsed.data.visible !== false ? [parsed.data] : []
  })
  const updates: PoolOpeningUpdate[] = []

  const resolveSupportSlabId = (pool: PoolNode, opening: PolygonPoint2D[]) => {
    const storedSupport = pool.supportSlabId
      ? slabs.find((slab) => slab.id === pool.supportSlabId)
      : undefined
    if (
      storedSupport &&
      storedSupport.parentId === pool.parentId &&
      storedSupport.visible !== false &&
      storedSupport.recessed !== true &&
      polygonContainsPolygon(storedSupport.polygon, opening)
    ) {
      return storedSupport.id
    }
    return slabs
      .filter((slab) =>
        slab.parentId === pool.parentId &&
        slab.visible !== false &&
        (slab as SlabNode & { recessed?: boolean }).recessed !== true &&
        polygonContainsPolygon(slab.polygon, opening),
      )
      .sort((left, right) =>
        (right.elevation ?? 0) - (left.elevation ?? 0) || left.id.localeCompare(right.id),
      )[0]?.id ?? null
  }

  for (const slab of slabs) {
    const existingHoles = slab.holes ?? []
    const existingMetadata = normalizeMetadata(slab)
    const storedManaged = readManagedPoolOpenings(slab)
    const legacyManaged = readLegacyPoolOpenings(slab)
    const previousManaged = storedManaged.length > 0 ? storedManaged : legacyManaged
    const managedHoleIndices = findManagedHoleIndices(existingHoles, previousManaged)
    const preserved = existingHoles
      .map((polygon, index) => ({ polygon, metadata: existingMetadata[index]! }))
      .filter((_, index) => !managedHoleIndices.has(index))
    const poolHoles = pools
      .map((pool) => ({
        ownerId: pool.id,
        polygon: getPoolOpeningPolygon(pool),
      }))
      .filter(({ ownerId, polygon }) => {
        const pool = pools.find((candidate) => candidate.id === ownerId)
        return pool ? resolveSupportSlabId(pool, polygon) === slab.id : false
      })
      .filter(({ polygon }) => polygonContainsPolygon(slab.polygon, polygon))
    const connectionHoles = connections
      .map((connection) => ({
        connection,
        ownerId: connection.id,
        polygon: getConnectionOpeningPolygon(connection),
      }))
      .filter(({ connection }) => connection.parentId === slab.parentId)
      .filter(({ connection, polygon }) =>
        connection.type === 'pool:spillover' || polygonContainsPolygon(slab.polygon, polygon),
      )
    const managedHoles = [...poolHoles, ...connectionHoles]
    const nextHoles = [...preserved.map(({ polygon }) => polygon), ...managedHoles.map(({ polygon }) => polygon)]
    const nextMetadata = [
      ...preserved.map(({ metadata }) => ({ ...metadata })),
      ...managedHoles.map((): ExistingHoleMetadata => ({ source: 'manual' })),
    ]
    const nextManaged = managedHoles.map(({ ownerId, polygon }, index) => ({
      poolId: ownerId,
      polygon,
      holeIndex: preserved.length + index,
    }))
    const nextSlabMetadata = withManagedPoolOpeningsMetadata(slab, nextManaged)

    if (
      !polygonsEqual(existingHoles, nextHoles) ||
      !metadataEqual(slab.holeMetadata as unknown[], nextMetadata) ||
      !managedPoolOpeningsEqual(storedManaged, nextManaged)
    ) {
      updates.push({
        id: slab.id as AnyNodeId,
        data: {
          holes: nextHoles,
          holeMetadata: nextMetadata,
          metadata: nextSlabMetadata,
        },
      })
    }
  }

  return updates
}
