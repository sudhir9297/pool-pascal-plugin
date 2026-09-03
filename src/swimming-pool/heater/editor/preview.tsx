'use client'

import { useRegistry, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useEditor } from '@pascal-app/editor'
import { useMemo, useRef } from 'react'
import { Quaternion, Vector3, type Group } from 'three'
import { usePipeEditStore } from '../../pipe/editor/store'
import { buildHeaterGeometry, getHeaterPortPositions, getHeaterPortsLocal } from '../core/geometry'
import type { PoolHeaterNode } from '../core/schema'

export default function PoolHeaterPreview({ node }: { node: PoolHeaterNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildHeaterGeometry(node), [node])
  const ports = useMemo(() => getHeaterPortsLocal(node).map((port) => ({ ...port, quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), port.direction) })), [node.bodyWidth, node.bodyHeight, node.bodyDepth, node.portDiameter])
  return <group position={node.position} rotation={node.rotation} ref={rootRef} {...handlers}>
    <primitive object={geometry} />
    {ports.map(({ role, position, quaternion }, index) => <mesh key={role} position={position} quaternion={quaternion} onPointerDown={(event) => {
      event.stopPropagation(); const port = getHeaterPortPositions(node)[index]!; usePipeEditStore.getState().beginDrawing([port.x, port.y, port.z]); useEditor.getState().setTool('pool:pipe-network'); useEditor.getState().setMode('build')
    }}>
      <cylinderGeometry args={[node.portDiameter * 1.45, node.portDiameter * 1.45, 0.08, 16]} />
      <meshBasicMaterial color={role === 'inlet' ? '#38bdf8' : '#22c55e'} transparent opacity={0.12} depthWrite={false} />
    </mesh>)}
    {node.showFlow && <mesh position={[0, node.bodyHeight * 0.16, node.bodyDepth / 2 + 0.04]}><coneGeometry args={[0.035, 0.12, 8]} /><meshBasicMaterial color="#22c55e" /></mesh>}
  </group>
}
