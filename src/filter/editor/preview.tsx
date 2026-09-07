'use client'

import { Quaternion, Vector3 } from 'three'
import { GeometryPreview } from '../../editor/geometry-preview'
import { buildFilterGeometry, getFilterPortsLocal } from '../core/geometry'
import type { PoolFilterNode } from '../core/schema'

export default function PoolFilterPreview({ node }: { node: PoolFilterNode }) {
  return <GeometryPreview node={node} buildGeometry={buildFilterGeometry}>
    {node.showFlow && <FlowArrows node={node} />}
  </GeometryPreview>
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
