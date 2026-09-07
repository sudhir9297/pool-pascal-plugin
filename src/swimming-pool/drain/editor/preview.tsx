'use client'

import { useNodeEvents } from '@pascal-app/viewer'
import { useRegistry, type AnyNode } from '@pascal-app/core'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { buildDrainGeometry } from '../core/geometry'
import type { PoolDrainNode } from '../core/schema'

export default function PoolDrainPreview({ node }: { node: PoolDrainNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildDrainGeometry(node), [node])
  return <group position={node.position} rotation={node.rotation} ref={rootRef} {...handlers}>
    <primitive object={geometry} />
    {node.showFlow && <mesh position={[0, 0.035, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.028, 0.1, 8]} />
      <meshBasicMaterial color="#38bdf8" />
    </mesh>}
  </group>
}
