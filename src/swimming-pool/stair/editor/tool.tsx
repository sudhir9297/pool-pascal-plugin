'use client'

import { type AnyNode, emitter, type GridEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { CursorSphere, isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group, Material, Mesh } from 'three'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import { findNearestPoolWall, type SkimmerPlacement } from '../../skimmer/design/placement'
import type { PoolNode } from '../../core/schema'
import { poolStairDefinition } from '../core/definition'
import { PoolStairNode } from '../core/schema'
import { buildPoolStairGeometry } from '../core/geometry'
import { getPoolStairPlacementSettings, usePoolStairStore } from './store'

export default function PoolStairTool() {
  const cursorRef = useRef<Group>(null)
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  const [placement, setPlacement] = useState<SkimmerPlacement | null>(null)
  const variant = usePoolStairStore((state) => state.variant)
  const stepCount = usePoolStairStore((state) => state.stepCount)
  const width = usePoolStairStore((state) => state.width)
  const depth = usePoolStairStore((state) => state.depth)
  const tubeDiameter = usePoolStairStore((state) => state.tubeDiameter)
  const treadDepth = usePoolStairStore((state) => state.treadDepth)
  const metalColor = usePoolStairStore((state) => state.metalColor)
  const ghostNode = useMemo(() => PoolStairNode.parse({
    ...poolStairDefinition.defaults(), variant, stepCount, width, depth, tubeDiameter, treadDepth, metalColor,
  }), [depth, metalColor, stepCount, treadDepth, tubeDiameter, variant, width])
  useEffect(() => {
    if (!levelId) return
    const getPlacement = (event: GridEvent) => {
      const level = sceneRegistry.nodes.get(levelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const point = snapPointToGrid([local[0], local[2]], step)
      const pools = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:pool') as unknown as PoolNode[]
      const next = findNearestPoolWall(point, pools)
      if (next) {
        const pool = pools.find((candidate) => candidate.id === next.poolId)
        next.position = [next.position[0], (pool?.position[1] ?? 0) + (pool?.finishedDeckElevation ?? 0), next.position[2]]
      }
      return next
    }
    const resolve = (event: GridEvent) => {
      const next = getPlacement(event)
      setPlacement(next)
      if (cursorRef.current && next) cursorRef.current.position.set(...next.position)
    }
    const onClick = (event: GridEvent) => {
      const next = getPlacement(event)
      if (!next) return
      const count = Object.values(useScene.getState().nodes).filter((node) => (node.type as string) === 'pool:stair').length
      const stair = PoolStairNode.parse({ ...poolStairDefinition.defaults(), ...getPoolStairPlacementSettings(), id: undefined, name: `Pool Stairs ${count + 1}`, parentId: levelId, poolId: next.poolId, wallIndex: next.wallIndex, wallT: next.wallT, position: next.position, rotation: next.rotation })
      useScene.getState().createNode(stair as unknown as AnyNode, levelId)
      setSelection({ selectedIds: [stair.id] }); useEditor.getState().setTool(null); useEditor.getState().setMode('select'); triggerSFX('sfx:structure-build')
    }
    const onCancel = () => { markToolCancelConsumed(); setPlacement(null); useEditor.getState().setTool(null); useEditor.getState().setMode('select') }
    emitter.on('grid:move', resolve); emitter.on('grid:click', onClick); emitter.on('tool:cancel', onCancel)
    return () => { emitter.off('grid:move', resolve); emitter.off('grid:click', onClick); emitter.off('tool:cancel', onCancel) }
  }, [levelId, setSelection])
  return <group><CursorSphere color={placement ? '#22c55e' : '#f97316'} ref={cursorRef} />{placement && <PoolStairGhost node={ghostNode} placement={placement} />}</group>
}

function PoolStairGhost({ node, placement }: { node: PoolStairNode; placement: SkimmerPlacement }) {
  const geometry = useMemo(() => {
    const group = buildPoolStairGeometry(node)
    group.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials as Material[]) {
        material.transparent = true
        material.opacity = 0.42
        material.depthWrite = false
      }
    })
    return group
  }, [node])
  useEffect(() => () => {
    const materials = new Set<Material>()
    geometry.traverse((child) => {
      const mesh = child as Mesh
      if (!mesh.isMesh) return
      mesh.geometry.dispose()
      const values = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of values as Material[]) materials.add(material)
    })
    for (const material of materials) material.dispose()
  }, [geometry])
  return <primitive object={geometry} position={placement.position} rotation={placement.rotation} />
}
