'use client'

import { useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { PoolNode } from '../../core/schema'
import { resolvePoolSpilloverCandidate } from '../design/interaction'
import { getPoolWorldPolygon, type PoolSpilloverPlacement } from '../design/placement'
import {
  getPoolSpilloverPlacementStage,
  subscribePoolSpilloverPlacementStage,
} from '../design/stage'

type FloorplanToolProps = { activeLevelId: string | null }

function svgPoints(points: ReadonlyArray<readonly [number, number]>) {
  return points.map(([x, z]) => `${x},${z}`).join(' ')
}

function clientToPlanPoint(group: SVGGElement, clientX: number, clientY: number) {
  const matrix = group.getScreenCTM()
  if (!matrix) return null
  const local = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
  return [local.x, local.y] as [number, number]
}

export default function PoolSpilloverFloorplanTool({ activeLevelId }: FloorplanToolProps) {
  const groupRef = useRef<SVGGElement>(null)
  const nodes = useScene((state) => state.nodes)
  const selectedId = useViewer((state) => state.selection.selectedIds.at(-1) ?? null)
  const stage = useSyncExternalStore(
    subscribePoolSpilloverPlacementStage,
    getPoolSpilloverPlacementStage,
    getPoolSpilloverPlacementStage,
  )
  const [sceneTransform, setSceneTransform] = useState<string | undefined>()
  const [target, setTarget] = useState<PoolNode | null>(null)
  const [preview, setPreview] = useState<PoolSpilloverPlacement | null>(null)
  const selectedValue = selectedId ? nodes[selectedId as never] : undefined
  const source = useMemo(() => {
    const result = PoolNode.safeParse(selectedValue)
    return stage === 'second-pool' && result.success ? result.data : null
  }, [selectedValue, stage])

  useEffect(() => {
    const group = groupRef.current
    const svg = group?.ownerSVGElement
    if (!(group && svg && activeLevelId && source)) {
      setTarget(null)
      setPreview(null)
      return
    }
    const scene = svg.querySelector<SVGGElement>('[data-floorplan-scene]')
    setSceneTransform(scene?.getAttribute('transform') ?? undefined)
    const onPointerMove = (event: PointerEvent) => {
      const point = clientToPlanPoint(group, event.clientX, event.clientY)
      if (!point) return
      const candidate = resolvePoolSpilloverCandidate(
        useScene.getState().nodes,
        [point[0], 0, point[1]],
        activeLevelId,
        source,
      )
      setTarget(candidate.pool?.id === source.id ? null : candidate.pool)
      setPreview(candidate.placement)
    }
    const clear = () => {
      setTarget(null)
      setPreview(null)
    }
    svg.addEventListener('pointermove', onPointerMove, true)
    svg.addEventListener('pointerleave', clear)
    return () => {
      svg.removeEventListener('pointermove', onPointerMove, true)
      svg.removeEventListener('pointerleave', clear)
    }
  }, [activeLevelId, source])

  return (
    <g ref={groupRef} pointerEvents="none" transform={sceneTransform}>
      {source ? (
        <polygon
          fill="rgba(34, 197, 94, 0.12)"
          points={svgPoints(getPoolWorldPolygon(source))}
          stroke="#22c55e"
          strokeDasharray="7 4"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {target ? (
        <polygon
          fill={preview ? 'rgba(56, 189, 248, 0.2)' : 'rgba(239, 68, 68, 0.16)'}
          points={svgPoints(getPoolWorldPolygon(target))}
          stroke={preview ? '#38bdf8' : '#ef4444'}
          strokeDasharray="7 4"
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {preview ? (
        <>
          <line
            opacity={0.34}
            stroke="#38bdf8"
            strokeLinecap="butt"
            strokeWidth={preview.width}
            x1={preview.connectionPath[0]?.[0]}
            x2={preview.connectionPath[1]?.[0]}
            y1={preview.connectionPath[0]?.[1]}
            y2={preview.connectionPath[1]?.[1]}
          />
          <polyline
            fill="none"
            points={svgPoints(preview.connectionPath)}
            stroke="#0284c7"
            strokeDasharray="7 4"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </>
      ) : null}
    </g>
  )
}
