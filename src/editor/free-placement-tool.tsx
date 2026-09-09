'use client'

import { emitter, nodeRegistry, type AnyNode, type GridEvent, type NodeEvent, type PipeSegmentNode, sceneRegistry, snapPointToGrid, useScene } from '@pascal-app/core'
import { CursorSphere, isGridSnapActive, markToolCancelConsumed, triggerSFX, useEditor } from '@pascal-app/editor'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useState } from 'react'
import { Box3, type Object3D } from 'three'
import { EquipmentGhost } from './equipment-ghost'
import { PoolLevelPreviewGroup } from './level-preview-group'
import { worldPointToPoolLevel } from '../design/level-coordinates'
import { createPoolPluginNode, type PoolPluginNodeType } from './scene-nodes'
import { disposeObject3D } from './dispose-object'
import { isInsertableEquipment, planEquipmentInsertionAsync, type EquipmentInsertionPlan } from '../design/equipment-insertion'
import { createRoutingClient } from './routing-client'
import { findValveInsertionTarget } from '../valve/design/inline-insertion'
import { type RouteObstacle } from '../design/pipe-route'
import { InsertionRouteGhost } from './insertion-route-ghost'
import { isPlacementRotationKey } from './placement-rotation'
import { connectionPreviewNode } from './connection-preview-node'
import { recordPipeInsertion } from '../core/insertion-removal'

export type PlacementPoint = [number, number, number]
type PlaceableNode = { id: string; type: PoolPluginNodeType }
type FreePlacementToolProps<Node extends PlaceableNode> = {
  cursorColor: string
  kind: Node['type']
  createNode: (position: PlacementPoint, sequence: number) => Node
  buildGeometry?: (node: Node) => Object3D
}

export function FreePlacementTool<Node extends PlaceableNode>({
  cursorColor, kind, createNode, buildGeometry,
}: FreePlacementToolProps<Node>) {
  const ghostNode = useMemo(() => createNode([0, 0, 0], 1), [createNode])
  const bounds = useMemo(() => {
    if (!buildGeometry) return null
    const geometry = buildGeometry(ghostNode)
    const box = new Box3().setFromObject(geometry)
    disposeObject3D(geometry)
    return box
  }, [buildGeometry, ghostNode])
  const [preview, setPreview] = useState<{ position: PlacementPoint; rotation: PlacementPoint; valid: boolean; pending?: boolean; plan: EquipmentInsertionPlan | null } | null>(null)
  const equipment = preview?.plan?.equipment
  const connectionDiameter = equipment ? equipment.type === 'pool:pump' ? equipment.diameter : equipment.portDiameter : null
  const displayNode = useMemo(() => connectionPreviewNode(ghostNode, connectionDiameter), [connectionDiameter, ghostNode])
  const levelId = useViewer((state) => state.selection.levelId)
  const setSelection = useViewer((state) => state.setSelection)

  useEffect(() => {
    if (!levelId) return
    let committed = false
    let disposed = false
    let generation = 0
    const routing = createRoutingClient()
    let yaw = 0
    let lastMove: GridEvent | NodeEvent | null = null
    let frame: number | null = null
    let cachedNodes: ReturnType<typeof useScene.getState>['nodes'] | null = null
    const plans = new Map<string, EquipmentInsertionPlan | null>()
    const obstacleCache = new Map<string, RouteObstacle[]>()
    let lastPlan: EquipmentInsertionPlan | null = null
    const resolve = async (event: GridEvent | NodeEvent) => {
      const request = ++generation
      const level = sceneRegistry.nodes.get(levelId as never)
      const local = worldPointToPoolLevel(level, event.position)
      const step = isGridSnapActive() ? useEditor.getState().gridSnapStep : 0
      const [x, z] = snapPointToGrid([local[0], local[2]], step)
      const position: PlacementPoint = [x, 0, z]
      const template = { ...createNode(position, 1), rotation: [0, yaw, 0] as PlacementPoint }
      let plan: EquipmentInsertionPlan | null = null
      let targeted = false
      if (bounds && isInsertableEquipment(template) && !event.nativeEvent?.altKey) {
        const nodes = useScene.getState().nodes
        if (nodes !== cachedNodes) {
          cachedNodes = nodes
          plans.clear()
          obstacleCache.clear()
          lastPlan = null
        }
        const runs = Object.values(nodes).filter((node): node is PipeSegmentNode => node.type === 'pipe-segment' && node.parentId === levelId)
        const directId = 'node' in event && event.node.type === 'pipe-segment' ? event.node.id : null
        const target = findValveInsertionTarget(directId ? runs.filter(run => run.id === directId) : runs, local, !!directId)
        targeted = !!target
        const fitting = nodeRegistry.get('pipe-fitting')
        if (target && fitting?.ports) {
          const point = target.point.map(value => step > 0 ? Math.round(value / step) * step : value) as PlacementPoint
          const key = JSON.stringify([target.run.id, target.index, point, yaw])
          if (plans.has(key)) {
            plan = plans.get(key)!
            return { position: plan?.equipment.position ?? position, rotation: plan?.equipment.rotation ?? template.rotation, valid: !!plan, plan }
          }
          let obstacles = obstacleCache.get(target.run.id)
          if (!obstacles) {
          obstacles = []
          level?.updateWorldMatrix(true, false)
          const inverse = level?.matrixWorld.clone().invert()
          for (const node of Object.values(nodes)) {
            if (node.parentId !== levelId || node.id === target.run.id) continue
            const object = sceneRegistry.nodes.get(node.id)
            if (!object) continue
            const box = new Box3().setFromObject(object)
            if (inverse) box.applyMatrix4(inverse)
            if (box.isEmpty()) continue
            box.expandByScalar(target.run.diameter * 0.0254 / 2 + 0.025)
            obstacles.push({ min: box.min.toArray(), max: box.max.toArray() })
          }
          obstacleCache.set(target.run.id, obstacles)
          }
          setPreview({ position, rotation: template.rotation, valid: false, pending: true, plan: lastPlan?.update.id === target.run.id ? lastPlan : null })
          plan = await planEquipmentInsertionAsync([target.run, target.index, point, template, bounds, fitting.ports, obstacles], async args => {
            if (disposed || request !== generation || useScene.getState().nodes !== nodes) throw new DOMException('Stale pipe route', 'AbortError')
            const result = await routing.route(args)
            if (disposed || request !== generation || useScene.getState().nodes !== nodes) throw new DOMException('Stale pipe route', 'AbortError')
            return result
          })
          if (plans.size >= 64) plans.delete(plans.keys().next().value!)
          plans.set(key, plan)
          lastPlan = plan
        }
      }
      return { position: plan?.equipment.position ?? position, rotation: plan?.equipment.rotation ?? template.rotation, valid: !targeted || !!plan, plan }
    }
    const finish = () => {
      useEditor.getState().setTool(null)
      useEditor.getState().setMode('select')
    }
    const onMove = (event: GridEvent | NodeEvent) => {
      lastMove = event
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        if (!committed && lastMove) {
          const task = resolve(lastMove)
          const issued = generation
          void task.then(result => {
            if (!disposed && !committed && issued === generation) setPreview(result)
          }).catch(error => {
            if (!disposed && issued === generation && error?.name !== 'AbortError') setPreview(current => current ? { ...current, valid: false, pending: false } : current)
          })
        }
      })
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isPlacementRotationKey(event)) return
      event.preventDefault()
      event.stopPropagation()
      yaw = (yaw + Math.PI / 2) % (Math.PI * 2)
      if (lastMove) onMove(lastMove)
    }
    const onClick = async (event: GridEvent | NodeEvent) => {
      const scene = useScene.getState()
      if (scene.readOnly || committed) return
      plans.clear()
      obstacleCache.clear()
      let resolved: Awaited<ReturnType<typeof resolve>>
      try { resolved = await resolve(event) } catch { return }
      if (disposed || committed || useScene.getState().readOnly || useScene.getState().nodes !== scene.nodes) return
      setPreview(resolved)
      if (!resolved.valid) return
      const sequence = Object.values(scene.nodes).filter(node => String(node.type) === kind).length + 1
      const node = { ...createNode(resolved.position, sequence), rotation: resolved.rotation }
      if (resolved.plan) {
        const plan = resolved.plan
        const original = scene.nodes[plan.update.id]
        if (original?.type !== 'pipe-segment') return
        const equipment = recordPipeInsertion({ ...plan.equipment, id: node.id, parentId: levelId, name: (node as { name?: string }).name }, original, plan.update.data, plan.tail, plan.members)
        scene.applyNodeChanges({
          update: [plan.update],
          create: [equipment as unknown as AnyNode, plan.tail, ...plan.members].map(member => ({ node: member, parentId: levelId })),
        })
      } else createPoolPluginNode(node, levelId)
      committed = true
      setSelection({ selectedIds: [node.id] })
      finish()
      triggerSFX('sfx:structure-build')
    }
    const onCancel = () => { markToolCancelConsumed(); finish() }
    emitter.on('grid:move', onMove)
    emitter.on('grid:click', onClick)
    emitter.on('pipe-segment:move', onMove)
    emitter.on('pipe-segment:click', onClick)
    emitter.on('tool:cancel', onCancel)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      disposed = true
      generation++
      routing.dispose()
      if (frame !== null) cancelAnimationFrame(frame)
      emitter.off('grid:move', onMove)
      emitter.off('grid:click', onClick)
      emitter.off('pipe-segment:move', onMove)
      emitter.off('pipe-segment:click', onClick)
      emitter.off('tool:cancel', onCancel)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [bounds, createNode, kind, levelId, setSelection])

  if (!preview) return null
  return <PoolLevelPreviewGroup>
    <group position={preview.position} rotation={preview.rotation}>
      {buildGeometry ? <EquipmentGhost node={displayNode} buildGeometry={buildGeometry} /> : null}
      <CursorSphere color={preview.pending ? '#f59e0b' : preview.valid ? cursorColor : '#dc2626'} />
    </group>
    {preview.plan ? <InsertionRouteGhost plan={preview.plan} pending={preview.pending} /> : null}
  </PoolLevelPreviewGroup>
}
