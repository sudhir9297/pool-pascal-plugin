'use client'

import { useEffect, useMemo } from 'react'
import { DoubleSide, Mesh, MeshBasicMaterial, Shape, ShapeGeometry, type Material } from 'three'
import { resolvePoolPolygon, type PoolNode } from '../../core/schema'
import { DEFAULT_POOL_SPILLOVER } from '../core/definition'
import { buildPoolSpilloverGeometry } from '../core/geometry'
import { PoolSpilloverNode } from '../core/schema'
import type { PoolSpilloverPlacement } from '../design/placement'
import { disposePoolSpilloverVisual } from './dispose-visual'

const NO_RAYCAST = () => {}

export function PoolPlacementHighlight({ pool, color }: { pool: PoolNode; color: string }) {
  const visual = useMemo(() => {
    const shape = new Shape()
    resolvePoolPolygon(pool).forEach(([x, z], index) => {
      if (index === 0) shape.moveTo(x, -z)
      else shape.lineTo(x, -z)
    })
    shape.closePath()
    const mesh = new Mesh(
      new ShapeGeometry(shape),
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, side: DoubleSide }),
    )
    mesh.name = 'pool-spillover-pool-highlight'
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = pool.designWaterElevation + 0.025
    mesh.renderOrder = 20
    mesh.raycast = NO_RAYCAST
    return mesh
  }, [color, pool])

  useEffect(() => () => {
    visual.geometry.dispose()
    visual.material.dispose()
  }, [visual])

  return <group position={pool.position} rotation={pool.rotation}><primitive object={visual} /></group>
}

export function PoolSpilloverPlacementGhost({ placement }: { placement: PoolSpilloverPlacement }) {
  const node = useMemo(() => PoolSpilloverNode.parse({
    ...DEFAULT_POOL_SPILLOVER,
    ...placement,
    id: 'pool-spillover_preview',
    name: 'Pool spillover preview',
    parentId: null,
  }), [placement])
  const geometry = useMemo(() => {
    const group = buildPoolSpilloverGeometry(node)
    group.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.raycast = NO_RAYCAST
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) {
        material.transparent = true
        material.opacity = Math.min(material.opacity, 0.52)
        material.depthWrite = false
      }
    })
    return group
  }, [node])

  useEffect(() => () => disposePoolSpilloverVisual(geometry), [geometry])

  return <primitive object={geometry} position={node.position} rotation={node.rotation} />
}
