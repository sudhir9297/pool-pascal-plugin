'use client'

import { useNodeEvents, useViewer } from '@pascal-app/viewer'
import { useRegistry, type AnyNode } from '@pascal-app/core'
import { triggerSFX, useEditor } from '@pascal-app/editor'
import { useMemo, useRef, useState } from 'react'
import type { Group } from 'three'
import { buildDrainGeometry } from '../core/geometry'
import type { PoolDrainNode } from '../core/schema'
import { getDrainPipeConnection } from '../design/placement'
import { usePipeEditStore } from '../../pipe/editor/store'

export default function PoolDrainPreview({ node }: { node: PoolDrainNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  const selected = useViewer((state) => state.selection.selectedIds.includes(node.id))
  const pipeToolActive = useEditor((state) => state.mode === 'build' && state.tool === 'pool:pipe-network')
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildDrainGeometry(node), [node])
  return <group position={node.position} rotation={node.rotation} ref={rootRef} {...handlers}>
    <primitive object={geometry} />
    <DrainSocketControl node={node} visible={selected || pipeToolActive} />
    {node.showFlow && <mesh position={[0, 0.035, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.028, 0.1, 8]} />
      <meshBasicMaterial color="#38bdf8" />
    </mesh>}
  </group>
}

function DrainSocketControl({ node, visible }: { node: PoolDrainNode; visible: boolean }) {
  const [hovered, setHovered] = useState(false)
  const startPipe = (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
    const connection = getDrainPipeConnection(node)
    usePipeEditStore.getState().beginDrawingFrom(connection.position, connection.direction, 'drain')
    useEditor.getState().setTool('pool:pipe-network')
    useEditor.getState().setMode('build')
    triggerSFX('sfx:structure-build-start')
  }
  return <mesh
    position={[0, -node.bodyDepth * 1.4, 0]}
    rotation={[0, 0, 0]}
    onPointerDown={startPipe}
    onPointerOver={(event) => { event.stopPropagation(); setHovered(true) }}
    onPointerOut={() => setHovered(false)}
    userData={{ pipeControl: true }}
  >
    <cylinderGeometry args={[node.diameter * 1.8, node.diameter * 1.8, 0.08, 16]} />
    <meshBasicMaterial color={hovered ? '#22c55e' : '#facc15'} transparent opacity={hovered ? 0.22 : visible ? 0.12 : 0.03} depthTest={false} depthWrite={false} />
  </mesh>
}
