'use client'

import { useRegistry, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useMemo, useRef } from 'react'
import { Quaternion, Vector3, type Group } from 'three'
import { buildFilterGeometry, getFilterPortsLocal } from '../core/geometry'
import type { PoolFilterNode } from '../core/schema'

export default function PoolFilterPreview({ node }: { node: PoolFilterNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildFilterGeometry(node), [node])
  return <group position={node.position} rotation={node.rotation} ref={rootRef} {...handlers}>
    <primitive object={geometry} />
    {node.showFlow && <FlowArrows node={node} />}
  </group>
}

function FlowArrows({ node }: { node: PoolFilterNode }) {
  return <group>{getFilterPortsLocal(node).map((port) => {
    const flowDirection = port.role === 'inlet' ? port.direction.clone().negate() : port.direction
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), flowDirection)
    const position = port.position.clone().add(port.direction.clone().multiplyScalar(port.role === 'inlet' ? 0.08 : 0.05))
    return <mesh key={port.role} position={position} quaternion={quaternion}>
      <coneGeometry args={[0.03, 0.085, 10]} />
      <meshBasicMaterial color={port.role === 'inlet' ? '#38bdf8' : port.role === 'outlet' ? '#22c55e' : '#2563eb'} />
    </mesh>
  })}</group>
}
