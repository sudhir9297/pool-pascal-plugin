'use client'

import { useNodeEvents, useViewer } from '@pascal-app/viewer'
import { useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { triggerSFX, useEditor } from '@pascal-app/editor'
import { useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import { buildSkimmerGeometry } from '../core/geometry'
import type { PoolSkimmerNode } from '../core/schema'
import { getSkimmerPipeConnection } from '../design/placement'
import { usePipeEditStore } from '../../pipe/editor/store'
import { resolveMountedSkimmer } from '../design/placement'

export default function PoolSkimmerPreview({ node }: { node: PoolSkimmerNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  const selected = useViewer((state) => state.selection.selectedIds.includes(node.id))
  const pipeToolActive = useEditor((state) => state.tool === 'pool:pipe-network')
  const pool = useScene((state) => node.poolId ? (state.nodes as unknown as Record<string, PoolSkimmerNode>)[node.poolId] : undefined)
  const mountedNode = useMemo(() => resolveMountedSkimmer(node, pool as never), [node, pool])
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildSkimmerGeometry(mountedNode), [mountedNode])
  return <group position={mountedNode.position} rotation={mountedNode.rotation} ref={rootRef} {...handlers}><primitive object={geometry} /><SkimmerSocketControl node={mountedNode} showOverlay={selected || pipeToolActive} showCutaway={pipeToolActive} />{mountedNode.showFlow && <FlowArrows />}</group>
}

function FlowArrows() {
  return <group position={[0, 0.02, 0.16]} renderOrder={998}>
    {[0, 0.14].map((x) => <group key={x} position={[x - 0.07, 0, 0]} rotation={[0, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.16, 8]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.72} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -0.09]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.025, 0.055, 8]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.82} depthTest={false} depthWrite={false} />
      </mesh>
    </group>)}
  </group>
}

function SkimmerSocketControl({ node, showOverlay, showCutaway }: { node: PoolSkimmerNode; showOverlay: boolean; showCutaway: boolean }) {
  const [hovered, setHovered] = useState(false)
  const startPipe = (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    const connection = getSkimmerPipeConnection(node)
    usePipeEditStore.getState().beginDrawingFrom(connection.position, connection.direction)
    useEditor.getState().setTool('pool:pipe-network')
    useEditor.getState().setMode('build')
    triggerSFX('sfx:structure-build-start')
  }
  return <group position={[0, node.waterlineOffset - 0.31, -0.145]}>
    <mesh
      renderOrder={1000}
      onPointerDown={startPipe}
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <cylinderGeometry args={[0.11, 0.11, 0.035, 16]} />
      <meshBasicMaterial color={hovered ? '#22c55e' : '#facc15'} transparent opacity={hovered ? 0.22 : showOverlay ? 0.16 : 0.04} depthTest={false} depthWrite={false} />
    </mesh>
    <mesh renderOrder={1001} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]}>
      <torusGeometry args={[0.085, hovered ? 0.012 : 0.008, 8, 20]} />
      <meshBasicMaterial color={hovered ? '#22c55e' : '#facc15'} transparent opacity={showOverlay ? 1 : 0.7} depthTest={false} depthWrite={false} />
    </mesh>
    {showCutaway && <mesh renderOrder={999} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.1]}>
      <cylinderGeometry args={[0.065, 0.065, 0.2, 16]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.18} depthTest={false} depthWrite={false} />
    </mesh>}
  </group>
}
