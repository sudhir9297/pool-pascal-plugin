'use client'

import { useNodeEvents } from '@pascal-app/viewer'
import { useRegistry, useScene, type AnyNode } from '@pascal-app/core'
import { useEditor } from '@pascal-app/editor'
import { useMemo, useRef, useState } from 'react'
import { Euler, Quaternion, Vector3, type Group } from 'three'
import { buildValveGeometry, getValvePortLocalPositions, getValvePortPositions } from '../core/geometry'
import type { PoolValveNode } from '../core/schema'
import type { PoolPipeNode } from '../../pipe/core/schema'
import { getOccupiedValveSlots, getValveSlotKey } from '../design/placement'
import { usePipeEditStore } from '../../pipe/editor/store'

export default function PoolValvePreview({ node }: { node: PoolValveNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildValveGeometry(node), [node])
  const [hoveredPort, setHoveredPort] = useState<number | null>(null)
  const sceneNodes = useScene((state) => state.nodes)
  const occupiedSlots = useMemo(() => {
    const pipes = Object.values(sceneNodes).filter((candidate) => (candidate.type as string) === 'pool:pipe-network') as unknown as PoolPipeNode[]
    return getOccupiedValveSlots([node], pipes)
  }, [node, sceneNodes])
  const ports = useMemo(() => {
    const worldPositions = getValvePortPositions(node)
    return getValvePortLocalPositions(node).map((position, index) => {
    const direction = position.clone().normalize()
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), direction)
      return { localPosition: position.multiplyScalar(0.92), worldPosition: worldPositions[index]!, quaternion }
    })
  }, [node])
  return <group position={node.position} rotation={node.rotation} ref={rootRef} {...handlers}>
    <primitive object={geometry} />
    {ports.map(({ localPosition, worldPosition, quaternion }, index) => {
      const occupied = occupiedSlots.has(getValveSlotKey(node.id, index))
      return <group key={index} position={localPosition} quaternion={quaternion}>
      <mesh
        onPointerDown={(event) => {
          event.stopPropagation()
          if (occupied) return
          const localDirection = getValvePortLocalPositions(node)[index]!.clone().normalize()
          const worldDirection = localDirection.applyEuler(new Euler(node.rotation[0], node.rotation[1], node.rotation[2]))
          usePipeEditStore.getState().beginDrawingFrom(
            [worldPosition.x, worldPosition.y, worldPosition.z],
            [worldDirection.x, worldDirection.y, worldDirection.z],
            'level',
          )
          useEditor.getState().setTool('pool:pipe-network')
          useEditor.getState().setMode('build')
        }}
        onPointerOver={(event) => { event.stopPropagation(); if (!occupied) setHoveredPort(index) }}
        onPointerOut={() => setHoveredPort((current) => current === index ? null : current)}
        userData={{ pipeControl: true }}
      >
        <sphereGeometry args={[Math.max(node.diameter * 1.15, 0.075), 16, 12]} />
        <meshBasicMaterial color={occupied ? '#94a3b8' : hoveredPort === index ? '#22c55e' : '#facc15'} transparent opacity={occupied ? 0.03 : hoveredPort === index ? 0.2 : 0.06} depthWrite={false} />
      </mesh>
      <mesh renderOrder={10}>
        <torusGeometry args={[node.diameter * 0.7, hoveredPort === index ? 0.014 : 0.009, 8, 20]} />
        <meshBasicMaterial color={occupied ? '#94a3b8' : hoveredPort === index ? '#22c55e' : '#facc15'} depthTest={false} depthWrite={false} />
      </mesh>
      </group>
    })}
  </group>
}
