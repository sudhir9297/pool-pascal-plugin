'use client'

import { useNodeEvents } from '@pascal-app/viewer'
import { useRegistry, type AnyNode } from '@pascal-app/core'
import { ARROW_SCALE, HandleArrow, swallowNextClick, useEditor } from '@pascal-app/editor'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { OrthographicCamera, Quaternion, Vector3, type Group, type Material, type Mesh } from 'three'
import { buildPipeGeometry } from '../core/geometry'
import type { PoolPipeNode } from '../core/schema'
import { usePipeEditStore } from './store'

export default function PoolPipePreview({ node }: { node: PoolPipeNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id, node.type, rootRef)
  const pipe = useMemo(() => {
    return buildPipeGeometry(node)
  }, [node])

  useEffect(() => () => {
    pipe.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) material.dispose()
    })
  }, [pipe])

  return (
    <group
      position={node.position}
      ref={rootRef}
      rotation={node.rotation}
      {...handlers}
    >
      <primitive object={pipe} />
    </group>
  )
}

export function OpenEndpointHandles({
  node,
  rootRef,
}: {
  node: PoolPipeNode
  rootRef: { current: Group | null }
}) {
  const [activeEndpointId, setActiveEndpointId] = useState<string | null>(null)
  const degreeByNode = new Map<string, number>()
  for (const edge of node.edges) {
    degreeByNode.set(edge.from, (degreeByNode.get(edge.from) ?? 0) + 1)
    degreeByNode.set(edge.to, (degreeByNode.get(edge.to) ?? 0) + 1)
  }

  return (
    <group>
      {node.nodes
        .filter((pipeNode) => pipeNode.kind === 'endpoint' && degreeByNode.get(pipeNode.id) === 1)
        .map((pipeNode) => {
          const edge = node.edges.find((candidate) => candidate.from === pipeNode.id || candidate.to === pipeNode.id)
          const neighborId = edge?.from === pipeNode.id ? edge.to : edge?.from
          const neighbor = node.nodes.find((candidate) => candidate.id === neighborId)
          if (!neighbor) return null
          const direction = new Vector3(
            pipeNode.position[0] - neighbor.position[0],
            pipeNode.position[1] - neighbor.position[1],
            pipeNode.position[2] - neighbor.position[2],
          ).normalize()
          const plusQuaternion = new Quaternion().setFromUnitVectors(
            new Vector3(0, 0, 1),
            direction,
          )
          return (
            <group
              key={pipeNode.id}
              position={pipeNode.position}
              userData={{ pipeControl: true }}
            >
              <EndpointGizmoTrigger
                active={activeEndpointId === pipeNode.id}
                onToggle={() => setActiveEndpointId((current) => current === pipeNode.id ? null : pipeNode.id)}
                rotationY={Math.atan2(direction.x, direction.z)}
              />
              {activeEndpointId === pipeNode.id && <PipePivotGizmo />}
              <group
                position={[direction.x * 0.42, direction.y * 0.42, direction.z * 0.42]}
                quaternion={[plusQuaternion.x, plusQuaternion.y, plusQuaternion.z, plusQuaternion.w]}
                onPointerDown={(event) => {
                  event.stopPropagation()
                  event.nativeEvent.stopPropagation()
                  event.nativeEvent.stopImmediatePropagation()
                  event.nativeEvent.preventDefault()
                  swallowNextClick()
                  usePipeEditStore.getState().beginExtension({ networkId: node.id, endpointId: pipeNode.id })
                  useEditor.getState().setTool('pool:pipe-network')
                  useEditor.getState().setMode('build')
                }}
                onPointerUp={(event) => {
                  event.stopPropagation()
                  event.nativeEvent.stopImmediatePropagation()
                }}
              >
                <mesh frustumCulled={false} renderOrder={10} userData={{ pipeControl: true }}>
                  <boxGeometry args={[0.2, 0.06, 0.06]} />
                  <meshBasicMaterial color="#8381ed" depthTest={false} depthWrite={false} opacity={0.85} transparent />
                </mesh>
                <mesh frustumCulled={false} renderOrder={10} userData={{ pipeControl: true }}>
                  <boxGeometry args={[0.06, 0.06, 0.2]} />
                  <meshBasicMaterial color="#8381ed" depthTest={false} depthWrite={false} opacity={0.85} transparent />
                </mesh>
              </group>
            </group>
          )
        })}
    </group>
  )
}

function EndpointGizmoTrigger({
  active,
  onToggle,
  rotationY,
}: {
  active: boolean
  onToggle: () => void
  rotationY: number
}) {
  const [hovered, setHovered] = useState(false)
  const { camera } = useThree()
  const baseScale = camera instanceof OrthographicCamera ? 1 / camera.zoom : 1

  return (
    <HandleArrow
      cursor="grab"
      hover={hovered || active}
      hoverScale={1.15}
      onHoverChange={setHovered}
      onPointerDown={(event) => {
        event.stopPropagation()
        event.nativeEvent.stopPropagation()
        event.nativeEvent.stopImmediatePropagation()
        event.nativeEvent.preventDefault()
        swallowNextClick()
        onToggle()
      }}
      placement={{ position: [0, 0, 0], rotation: [0, rotationY, 0], baseScale: baseScale * ARROW_SCALE }}
      shape="tracker"
    />
  )
}

function PipePivotGizmo() {
  return (
    <group scale={0.72}>
      <mesh frustumCulled={false} renderOrder={1300}>
        <sphereGeometry args={[0.09, 16, 12]} />
        <meshBasicMaterial color="#ffff40" depthTest={false} depthWrite={false} />
      </mesh>
      <PipeGizmoAxis color="#ff2060" rotation={[0, 0, -Math.PI / 2]} />
      <PipeGizmoAxis color="#20df80" />
      <PipeGizmoAxis color="#2080ff" rotation={[Math.PI / 2, 0, 0]} />
      <mesh
        position={[0.22, 0.22, 0]}
        rotation={[0, 0, Math.PI / 2]}
        frustumCulled={false}
        renderOrder={1300}
      >
        <planeGeometry args={[0.16, 0.16]} />
        <meshBasicMaterial color="#2080ff" transparent opacity={0.22} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh
        position={[0.22, 0, 0.22]}
        rotation={[Math.PI / 2, 0, 0]}
        frustumCulled={false}
        renderOrder={1300}
      >
        <planeGeometry args={[0.16, 0.16]} />
        <meshBasicMaterial color="#20df80" transparent opacity={0.22} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh
        position={[0, 0.22, 0.22]}
        rotation={[0, Math.PI / 2, 0]}
        frustumCulled={false}
        renderOrder={1300}
      >
        <planeGeometry args={[0.16, 0.16]} />
        <meshBasicMaterial color="#ff2060" transparent opacity={0.22} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

function PipeGizmoAxis({
  color,
  rotation = [0, 0, 0],
}: {
  color: string
  rotation?: [number, number, number]
}) {
  return (
    <group rotation={rotation}>
      <mesh position={[0, 0.2, 0]} frustumCulled={false} renderOrder={1300}>
        <cylinderGeometry args={[0.018, 0.018, 0.38, 8]} />
        <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.42, 0]} frustumCulled={false} renderOrder={1300}>
        <coneGeometry args={[0.055, 0.12, 12]} />
        <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}
