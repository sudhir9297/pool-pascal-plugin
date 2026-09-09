'use client'

import { nodeRegistry, sceneRegistry, useScene } from '@pascal-app/core'
import { useEffect, useMemo } from 'react'
import { CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, Vector3 } from 'three'
import type { EquipmentInsertionPlan } from '../design/equipment-insertion'
import { disposeObject3D } from './dispose-object'

export function InsertionRouteGhost({ plan, pending = false }: { plan: EquipmentInsertionPlan; pending?: boolean }) {
  useEffect(() => {
    const object = sceneRegistry.nodes.get(plan.update.id)
    if (!object) return
    const visible = object.visible
    object.visible = false
    return () => { object.visible = visible }
  }, [plan.update.id])
  const geometry = useMemo(() => {
    const group = new Group()
    const source = useScene.getState().nodes[plan.update.id]
    const retained = source?.type === 'pipe-segment'
      ? [{ ...source, ...plan.update.data }, plan.tail] : [plan.tail]
    for (const pipe of [...retained, ...plan.members]) {
      const isRetained = retained.includes(pipe as typeof retained[number])
      if (pipe.type === 'pipe-fitting') {
        const fitting = nodeRegistry.get('pipe-fitting')?.geometry?.(pipe, {
          resolve: id => useScene.getState().nodes[id] as never,
          children: [], siblings: [], parent: null,
        })
        if (fitting) {
          fitting.position.set(...pipe.position)
          fitting.rotation.set(...pipe.rotation)
          group.add(fitting)
        }
        continue
      }
      for (let i = 1; i < pipe.path.length; i++) {
        const start = new Vector3(...pipe.path[i - 1]!), end = new Vector3(...pipe.path[i]!)
        const delta = end.clone().sub(start)
        const mesh = new Mesh(new CylinderGeometry(pipe.diameter * 0.0254 / 2, pipe.diameter * 0.0254 / 2, delta.length(), 12), new MeshBasicMaterial({ color: isRetained ? '#94a3b8' : '#16a34a', transparent: true, opacity: 0.8, depthWrite: false }))
        mesh.position.copy(start).add(end).multiplyScalar(0.5)
        mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize())
        group.add(mesh)
      }
    }
    for (const point of [plan.update.data.path?.at(-1), plan.tail.path[0]]) {
      if (!point) continue
      const marker = new Mesh(new SphereGeometry(0.07, 12, 8), new MeshBasicMaterial({ color: '#22c55e', depthTest: false }))
      marker.position.set(...point)
      group.add(marker)
    }
    group.traverse(object => { object.raycast = () => undefined })
    return group
  }, [plan])
  useEffect(() => {
    if (!pending) return
    const restore: Array<() => void> = []
    geometry.traverse(object => {
      if (!(object instanceof Mesh)) return
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        const { opacity, transparent } = material
        material.transparent = true
        material.opacity = 0.2
        material.needsUpdate = true
        restore.push(() => { material.opacity = opacity; material.transparent = transparent; material.needsUpdate = true })
      }
    })
    return () => restore.forEach(reset => reset())
  }, [geometry, pending])
  useEffect(() => () => disposeObject3D(geometry), [geometry])
  return <primitive object={geometry} />
}
