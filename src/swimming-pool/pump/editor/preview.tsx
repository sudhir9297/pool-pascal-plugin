'use client'

import { useNodeEvents } from '@pascal-app/viewer'
import { useRegistry, type AnyNode } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { useMemo, useRef } from 'react'
import { Quaternion, Vector3, type Group } from 'three'
import { buildPumpGeometry, getPumpPortLocalPositions, getPumpPortPositions, PUMP_PORT_DIRECTIONS } from '../core/geometry'
import type { PoolPumpNode } from '../core/schema'
import { usePipeEditStore } from '../../pipe/editor/store'

export default function PoolPumpPreview({ node }: { node: PoolPumpNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildPumpGeometry(node), [node])
  const ports = useMemo(() => getPumpPortLocalPositions(node).map((position, index) => {
    const direction = PUMP_PORT_DIRECTIONS[index]!
    return { position, quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction) }
  }), [node.bodyDepth, node.bodyHeight, node.diameter])
  return <group position={node.position} rotation={node.rotation} ref={rootRef} {...handlers}>
    <primitive object={geometry} />
    {ports.map(({ position, quaternion }, index) => <mesh key={index} position={position} quaternion={quaternion} onPointerDown={(event) => {
      event.stopPropagation()
      const port = getPumpPortPositions(node)[index]!
      usePipeEditStore.getState().beginDrawing([port.x, port.y, port.z])
      useEditor.getState().setTool('pool:pipe-network'); useEditor.getState().setMode('build')
    }}>
      <cylinderGeometry args={[node.diameter * 1.65, node.diameter * 1.65, 0.08, 16]} />
      <meshBasicMaterial color={index === 0 ? '#38bdf8' : '#22c55e'} transparent opacity={0.12} depthWrite={false} />
    </mesh>)}
    {node.showFlow && <FlowArrows />}
  </group>
}

function FlowArrows() {
  return <group position={[0, 0.14, 0]}>
    <mesh rotation={[0, 0, Math.PI / 2]}><coneGeometry args={[0.035, 0.12, 8]} /><meshBasicMaterial color="#22c55e" /></mesh>
  </group>
}
