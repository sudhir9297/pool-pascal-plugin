'use client'

import { useNodeEvents } from '@pascal-app/viewer'
import { useRegistry, type AnyNode } from '@pascal-app/core'
import { useMemo, useRef } from 'react'
import { type Group } from 'three'
import { buildPumpGeometry } from '../core/geometry'
import type { PoolPumpNode } from '../core/schema'

export default function PoolPumpPreview({ node }: { node: PoolPumpNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildPumpGeometry(node), [node])
  return <group position={node.position} rotation={node.rotation} ref={rootRef} {...handlers}>
    <primitive object={geometry} />
    {node.showFlow && <FlowArrows />}
  </group>
}

function FlowArrows() {
  return <group position={[0, 0.14, 0]}>
    <mesh rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[0.035, 0.12, 8]} /><meshBasicMaterial color="#22c55e" /></mesh>
  </group>
}
