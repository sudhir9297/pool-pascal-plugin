'use client'

import { useNodeEvents } from '@pascal-app/viewer'
import { useRegistry, type AnyNode } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { useMemo, useRef } from 'react'
import { Quaternion, Vector3, type Group } from 'three'
import { buildValveGeometry, getValvePortLocalPositions, getValvePortPositions } from '../core/geometry'
import type { PoolValveNode } from '../core/schema'
import { usePipeEditStore } from '../../pipe/editor/store'

export default function PoolValvePreview({ node }: { node: PoolValveNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildValveGeometry(node), [node])
  const ports = useMemo(() => getValvePortLocalPositions(node).map((position) => {
    const direction = position.clone().normalize()
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), direction)
    return { position: position.multiplyScalar(0.92), quaternion }
  }), [node.variant])
  return <group position={node.position} rotation={node.rotation} ref={rootRef} {...handlers}>
    <primitive object={geometry} />
    {ports.map(({ position, quaternion }, index) => <mesh key={index} position={position} quaternion={quaternion} onPointerDown={(event) => { event.stopPropagation(); const port = getValvePortPositions(node)[index]!; usePipeEditStore.getState().beginDrawing([port.x, port.y, port.z]); useEditor.getState().setTool('pool:pipe-network'); useEditor.getState().setMode('build') }}>
      <torusGeometry args={[node.diameter * 0.7, 0.008, 8, 16]} />
      <meshBasicMaterial color="#facc15" transparent opacity={0.05} depthWrite={false} />
    </mesh>)}
  </group>
}
