'use client'

import { useNodeEvents, useViewer } from '@pascal-app/viewer'
import { useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { triggerSFX, useEditor } from '@pascal-app/editor'
import { useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import { buildInletGeometry } from '../core/geometry'
import type { PoolInletNode } from '../core/schema'
import { getInletPipeConnection, resolveMountedInlet } from '../design/placement'
import { usePipeEditStore } from '../../pipe/editor/store'
import type { PoolNode } from '../../core/schema'

export default function PoolInletPreview({ node }: { node: PoolInletNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  const selected = useViewer((state) => state.selection.selectedIds.includes(node.id))
  const pipeToolActive = useEditor((state) => state.tool === 'pool:pipe-network')
  const pool = useScene((state) => node.poolId ? (state.nodes as unknown as Record<string, PoolNode>)[node.poolId] : undefined)
  const mountedNode = useMemo(() => resolveMountedInlet(node, pool), [node, pool])
  const geometry = useMemo(() => buildInletGeometry(mountedNode), [mountedNode])
  useRegistry(node.id, node.type, rootRef)
  return <group position={mountedNode.position} rotation={mountedNode.rotation} ref={rootRef} {...handlers}>
    <primitive object={geometry} position={[0, mountedNode.verticalOffset, 0]} />
    <InletSocketControl node={mountedNode} showOverlay={selected || pipeToolActive} />
    {mountedNode.showFlow && <FlowArrow length={mountedNode.flowLength} verticalOffset={mountedNode.verticalOffset} />}
  </group>
}

function InletSocketControl({ node, showOverlay }: { node: PoolInletNode; showOverlay: boolean }) {
  const [hovered, setHovered] = useState(false)
  const startPipe = (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    const connection = getInletPipeConnection(node)
    usePipeEditStore.getState().beginDrawingFrom(connection.position, connection.direction)
    useEditor.getState().setTool('pool:pipe-network')
    useEditor.getState().setMode('build')
    triggerSFX('sfx:structure-build-start')
  }
  return <group position={[0, node.verticalOffset, -node.bodyDepth - 0.02]}>
    <mesh renderOrder={1000} onPointerDown={startPipe} onPointerOver={(event) => { event.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
      <sphereGeometry args={[Math.max(node.nozzleDiameter * 1.5, 0.075), 16, 12]} />
      <meshBasicMaterial color={hovered ? '#22c55e' : '#facc15'} transparent opacity={hovered ? 0.22 : showOverlay ? 0.16 : 0.04} depthTest={false} depthWrite={false} />
    </mesh>
    <mesh renderOrder={1001} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[node.nozzleDiameter * 0.72, hovered ? 0.012 : 0.008, 8, 20]} />
      <meshBasicMaterial color={hovered ? '#22c55e' : '#facc15'} transparent opacity={showOverlay ? 1 : 0.7} depthTest={false} depthWrite={false} />
    </mesh>
  </group>
}

function FlowArrow({ length, verticalOffset }: { length: number; verticalOffset: number }) {
  return <group position={[0, verticalOffset, 0.16]} renderOrder={998}>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.008, 0.008, length, 8]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.72} depthTest={false} depthWrite={false} />
    </mesh>
    <mesh position={[0, 0, length / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.025, 0.055, 8]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.82} depthTest={false} depthWrite={false} />
    </mesh>
  </group>
}
