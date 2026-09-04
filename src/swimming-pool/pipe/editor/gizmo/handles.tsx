'use client'

import { type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { ConeGeometry, DoubleSide, MeshBasicMaterial, PlaneGeometry, TorusGeometry, CylinderGeometry } from 'three'
import { PIPE_AXIS_COLORS, PIPE_GIZMO_HIT_RENDER_ORDER, PIPE_GIZMO_HOVER_COLOR, PIPE_GIZMO_RENDER_ORDER } from './transform'
import type { PipeGizmoAxis, PipeGizmoPlane, PipeGizmoVisualState } from './types'

type AxisHandleProps = {
  axis: PipeGizmoAxis
  length: number
  radius: number
  hitRadius: number
  state: PipeGizmoVisualState
  disabled?: boolean
  onPointerDown: (axis: PipeGizmoAxis, event: ThreeEvent<PointerEvent>) => void
}

export function PipeAxisTransformHandle({ axis, length, radius, hitRadius, state, disabled = false, onPointerDown }: AxisHandleProps) {
  const [hovered, setHovered] = useState(false)
  const shaft = useMemo(() => new CylinderGeometry(radius * 0.35, radius * 0.35, length * 0.8, 10), [length, radius])
  const arrow = useMemo(() => new ConeGeometry(radius * 1.6, length * 0.2, 24), [length, radius])
  const hit = useMemo(() => new CylinderGeometry(hitRadius, hitRadius, length, 8), [hitRadius, length])
  const material = useMemo(() => new MeshBasicMaterial({ depthTest: false, depthWrite: false }), [])
  const hitMaterial = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false }), [])
  useEffect(() => {
    material.color.set(hovered && state !== 'faded' ? PIPE_GIZMO_HOVER_COLOR : PIPE_AXIS_COLORS[axis])
    material.opacity = state === 'faded' ? 0.14 : 1
  }, [axis, hovered, material, state])
  useEffect(() => () => { shaft.dispose(); arrow.dispose(); hit.dispose(); material.dispose(); hitMaterial.dispose() }, [arrow, hit, hitMaterial, material, shaft])
  const rotation: [number, number, number] = axis === 'x' ? [0, 0, -Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0]
  return <group rotation={rotation}>
    <mesh geometry={shaft} material={material} position={[0, length * 0.4, 0]} raycast={() => {}} renderOrder={PIPE_GIZMO_RENDER_ORDER} />
    <mesh geometry={arrow} material={material} position={[0, length * 0.9, 0]} raycast={() => {}} renderOrder={PIPE_GIZMO_RENDER_ORDER} />
    <mesh geometry={hit} material={hitMaterial} position={[0, length * 0.5, 0]} renderOrder={PIPE_GIZMO_HIT_RENDER_ORDER}
      onPointerDown={(event) => { if (disabled) return; event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); onPointerDown(axis, event) }}
      onPointerEnter={(event) => { if (!disabled) { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'grab' } }}
      onPointerLeave={() => { setHovered(false); if (document.body.style.cursor === 'grab') document.body.style.cursor = '' }} />
  </group>
}

type PlaneHandleProps = { plane: PipeGizmoPlane; offset: number; size: number; hitSize: number; state: PipeGizmoVisualState; disabled?: boolean; onPointerDown: (plane: PipeGizmoPlane, event: ThreeEvent<PointerEvent>) => void }
const PLANE_NORMAL: Record<PipeGizmoPlane, PipeGizmoAxis> = { xy: 'z', xz: 'y', yz: 'x' }

export function PipePlaneMoveHandle({ plane, offset, size, hitSize, state, disabled = false, onPointerDown }: PlaneHandleProps) {
  const [hovered, setHovered] = useState(false)
  const geometry = useMemo(() => new PlaneGeometry(size, size), [size])
  const hit = useMemo(() => new PlaneGeometry(hitSize, hitSize), [hitSize])
  const material = useMemo(() => new MeshBasicMaterial({ color: PIPE_AXIS_COLORS[PLANE_NORMAL[plane]], depthTest: false, depthWrite: false, side: DoubleSide, transparent: true }), [plane])
  const hitMaterial = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: DoubleSide }), [])
  useEffect(() => { material.color.set(hovered && state !== 'faded' ? PIPE_GIZMO_HOVER_COLOR : PIPE_AXIS_COLORS[PLANE_NORMAL[plane]]); material.opacity = state === 'faded' ? 0.1 : 1 }, [hovered, material, plane, state])
  useEffect(() => () => { geometry.dispose(); hit.dispose(); material.dispose(); hitMaterial.dispose() }, [geometry, hit, hitMaterial, material])
  const position: [number, number, number] = plane === 'xy' ? [offset, offset, 0] : plane === 'xz' ? [offset, 0, offset] : [0, offset, offset]
  const rotation: [number, number, number] = plane === 'xz' ? [-Math.PI / 2, 0, 0] : plane === 'yz' ? [0, Math.PI / 2, 0] : [0, 0, 0]
  return <group position={position} rotation={rotation}>
    <mesh geometry={geometry} material={material} raycast={() => {}} renderOrder={PIPE_GIZMO_RENDER_ORDER} />
    <mesh geometry={hit} material={hitMaterial} renderOrder={PIPE_GIZMO_HIT_RENDER_ORDER}
      onPointerDown={(event) => { if (disabled) return; event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); onPointerDown(plane, event) }}
      onPointerEnter={(event) => { if (!disabled) { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'move' } }}
      onPointerLeave={() => { setHovered(false); if (document.body.style.cursor === 'move') document.body.style.cursor = '' }} />
  </group>
}

type RotationHandleProps = { axis: PipeGizmoAxis; radius: number; tube: number; hitTube: number; arc: number; start: number; state: PipeGizmoVisualState; showVisual?: boolean; disabled?: boolean; onPointerDown: (axis: PipeGizmoAxis, event: ThreeEvent<PointerEvent>) => void }

/** Keep the interaction volume on the visible arc; a sphere creates a full
 * circular silhouette when an outline pass sees it. */
export function createPipeRotationHitGeometry(radius: number, hitTube: number, arc: number) {
  return new TorusGeometry(radius, hitTube, 8, 32, arc)
}

export function PipeRotationHandle({ axis, radius, tube, hitTube, arc, start, state, showVisual = true, disabled = false, onPointerDown }: RotationHandleProps) {
  const [hovered, setHovered] = useState(false)
  const ring = useMemo(() => new TorusGeometry(radius, tube * 0.35, 8, 32, arc), [arc, radius, tube])
  const hit = useMemo(() => createPipeRotationHitGeometry(radius, hitTube, arc), [arc, hitTube, radius])
  const material = useMemo(() => new MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: true }), [])
  // Keep the torus raycastable without allowing WebGPU to draw a faint
  // outline. Transparent zero-opacity geometry can still leak as an outline
  // with post-processing enabled, so disable color writes entirely.
  const hitMaterial = useMemo(() => new MeshBasicMaterial({ colorWrite: false, depthTest: false, depthWrite: false }), [])
  useEffect(() => { material.color.set(hovered && state !== 'faded' ? PIPE_GIZMO_HOVER_COLOR : PIPE_AXIS_COLORS[axis]); material.opacity = state === 'faded' ? 0.14 : 1 }, [axis, hovered, material, state])
  useEffect(() => () => { ring.dispose(); hit.dispose(); material.dispose(); hitMaterial.dispose() }, [hit, hitMaterial, material, ring])
  return <group>
    {showVisual && <mesh geometry={ring} material={material} raycast={() => {}} renderOrder={PIPE_GIZMO_RENDER_ORDER} rotation={[0, 0, start]} />}
    <mesh geometry={hit} material={hitMaterial} renderOrder={PIPE_GIZMO_HIT_RENDER_ORDER} rotation={[0, 0, start]}
      onPointerDown={(event) => { if (disabled) return; event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); onPointerDown(axis, event) }}
      onPointerEnter={(event) => { if (!disabled) { event.stopPropagation(); setHovered(true); document.body.style.cursor = 'grab' } }}
      onPointerLeave={() => { setHovered(false); if (document.body.style.cursor === 'grab') document.body.style.cursor = '' }} />
  </group>
}
