'use client'

import { emitter, type GridEvent, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useState } from 'react'
import { Mesh, MeshStandardMaterial } from 'three'
import { worldPointToPoolLevel } from '../../design/level-coordinates'
import { getPoolDrainPlacement, type PoolDrainPlacement } from '../design/pool-placement'
import { disposeObject3D } from '../../editor/dispose-object'
import { countNodesByType, createPoolPluginNode, getPoolNodes } from '../../editor/scene-nodes'
import { DEFAULT_POOL_DRAIN, PoolDrainNode } from '../core/schema'
import { buildDrainGeometry } from '../core/geometry'
import { isPlacementRotationKey } from '../../editor/placement-rotation'
import { PoolLevelPreviewGroup } from '../../editor/level-preview-group'

export default function PoolDrainTool() {
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)
  const [placement, setPlacement] = useState<PoolDrainPlacement | null>(null)
  const [yaw, setYaw] = useState(0)
  const ghostGeometry = useMemo(() => {
    const geometry = buildDrainGeometry(PoolDrainNode.parse({}))
    geometry.traverse((child) => {
      if (!(child instanceof Mesh)) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of materials) {
        if (!(material instanceof MeshStandardMaterial)) continue
        material.color.set('#38bdf8')
        material.emissive.set('#0e7490')
        material.emissiveIntensity = 0.35
        material.transparent = true
        material.opacity = 0.48
        material.depthWrite = false
      }
    })
    return geometry
  }, [])
  useEffect(() => () => disposeObject3D(ghostGeometry), [ghostGeometry])
  useEffect(() => {
    if (!levelId) { setPlacement(null); return }
    let rotationY = 0
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPlacementRotationKey(event)) return
      event.preventDefault()
      event.stopPropagation()
      rotationY = (rotationY + Math.PI / 2) % (Math.PI * 2)
      setYaw(rotationY)
    }
    const resolve = (event: GridEvent) => {
      const local = worldPointToPoolLevel(sceneRegistry.nodes.get(levelId as never), event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const [x, z] = snapPointToGrid([local[0], local[2]], step)
      const pools = getPoolNodes(useScene.getState().nodes, levelId)
      for (const pool of pools) {
        const placement = getPoolDrainPlacement(pool, [x, local[1], z])
        if (placement) return placement
      }
      return null
    }
    const onMove = (event: GridEvent) => {
      setPlacement(resolve(event))
    }
    const onClick = (event: GridEvent) => {
      const placement = resolve(event)
      if (!placement) return
      const count = countNodesByType(useScene.getState().nodes, 'pool:drain')
      const drain = PoolDrainNode.parse({ ...DEFAULT_POOL_DRAIN, id: undefined, name: `Pool Drain ${count + 1}`, position: placement.position, rotation: [0, rotationY, 0], poolId: placement.poolId })
      createPoolPluginNode(drain, levelId)
      setSelection({ selectedIds: [drain.id] }); useEditor.getState().setTool(null); useEditor.getState().setMode('select'); triggerSFX('sfx:structure-build')
    }
    const onCancel = () => { markToolCancelConsumed(); useEditor.getState().setTool(null); useEditor.getState().setMode('select') }
    emitter.on('grid:move', onMove); emitter.on('grid:click', onClick); emitter.on('tool:cancel', onCancel)
    window.addEventListener('keydown', onKeyDown, true)
    return () => { window.removeEventListener('keydown', onKeyDown, true); emitter.off('grid:move', onMove); emitter.off('grid:click', onClick); emitter.off('tool:cancel', onCancel) }
  }, [levelId, setSelection])
  return <PoolLevelPreviewGroup><group visible={placement !== null} position={placement?.position ?? [0, 0, 0]} rotation={[0, yaw, 0]}>
    <primitive object={ghostGeometry} />
  </group></PoolLevelPreviewGroup>
}
