'use client'
import { emitter, sceneRegistry, useScene, type GridEvent } from '@pascal-app/core'
import { consumePlacementDragRelease, markToolCancelConsumed, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useState } from 'react'
import { worldPointToPoolLevel } from '../design/level-coordinates'
import { resolvePoolAttachment } from '../design/pool-attachments'
import { getPoolNode } from './scene-nodes'
import { findNearestPoolWall } from '../skimmer/design/placement'
import { getPoolDrainPlacement } from '../drain/design/pool-placement'
import type { PoolSkimmerNode } from '../skimmer/core/schema'
import type { PoolInletNode } from '../inlet/core/schema'
import type { PoolDrainNode } from '../drain/core/schema'
import { PoolLevelPreviewGroup } from './level-preview-group'
import { EquipmentGhost } from './equipment-ghost'
import { buildSkimmerGeometry } from '../skimmer/core/geometry'
import { buildInletGeometry } from '../inlet/core/geometry'
import { buildDrainGeometry } from '../drain/core/geometry'
type Fitting = PoolSkimmerNode | PoolInletNode | PoolDrainNode
function buildGeometry(node: Fitting) {
  if (node.type === 'pool:skimmer') return buildSkimmerGeometry(node)
  if (node.type === 'pool:inlet') return buildInletGeometry(node)
  return buildDrainGeometry(node)
}
export default function MoveFittingTool({ node }: { node: Fitting }) {
  const levelId = useViewer(state => state.selection.levelId)
  const [preview, setPreview] = useState<Fitting | null>(null)
  useEffect(() => {
    if (!levelId) return
    let next: Fitting | null = null
    let finished = false
    const object = sceneRegistry.nodes.get(node.id as never)
    const originalVisible = object?.visible
    const exit = () => {
      if (object) object.visible = originalVisible ?? true
      useEditor.getState().setMovingNode(null)
    }
    const move = (event: GridEvent) => {
      const pool = getPoolNode(useScene.getState().nodes, node.poolId)
      if (!pool) return
      const point = worldPointToPoolLevel(sceneRegistry.nodes.get(levelId as never), event.position)
      const placement = node.type === 'pool:drain' ? getPoolDrainPlacement(pool, point) : findNearestPoolWall([point[0], point[2]], [pool])
      next = placement ? { ...node, ...placement, parentId: levelId, ...(node.type === 'pool:drain' ? { floorAnchor: undefined } : {}) } as Fitting : null
      setPreview(next)
      if (object) object.visible = !next && (originalVisible ?? true)
    }
    const commit = () => {
      if (finished || !next || useScene.getState().readOnly) return
      const pool = getPoolNode(useScene.getState().nodes, node.poolId)
      const attached = pool && resolvePoolAttachment(next, pool)
      if (!attached) return
      finished = true
      useScene.getState().updateNode(node.id as never, attached as never)
      exit()
    }
    const cancel = () => { finished = true; markToolCancelConsumed(); exit() }
    const release = (event: PointerEvent) => {
      if (!consumePlacementDragRelease(event)) return
      if (next) commit(); else exit()
      event.stopPropagation()
    }
    emitter.on('grid:move', move); emitter.on('grid:click', commit); emitter.on('tool:cancel', cancel)
    window.addEventListener('pointerup', release)
    return () => {
      emitter.off('grid:move', move); emitter.off('grid:click', commit); emitter.off('tool:cancel', cancel)
      window.removeEventListener('pointerup', release)
      if (object) object.visible = originalVisible ?? true
    }
  }, [levelId, node])
  return <PoolLevelPreviewGroup>{preview && <group position={preview.position} rotation={preview.rotation}>
    <group position={[0, preview.type === 'pool:inlet' ? preview.verticalOffset : 0, 0]}>
      <EquipmentGhost node={preview} buildGeometry={buildGeometry} />
    </group>
  </group>}</PoolLevelPreviewGroup>
}
