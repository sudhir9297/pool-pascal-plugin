'use client'

import { useRegistry, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useMemo, useRef } from 'react'
import { type Group } from 'three'
import { buildHeaterGeometry, getHeaterPortsLocal } from '../core/geometry'
import type { PoolHeaterNode } from '../core/schema'

export default function PoolHeaterPreview({ node }: { node: PoolHeaterNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildHeaterGeometry(node), [node])
  return <group position={node.position} rotation={node.rotation} ref={rootRef} {...handlers}>
    <primitive object={geometry} />
    {node.showFlow && <mesh position={[0, node.bodyHeight * 0.16, node.bodyDepth / 2 + 0.04]}><coneGeometry args={[0.035, 0.12, 8]} /><meshBasicMaterial color="#22c55e" /></mesh>}
  </group>
}
