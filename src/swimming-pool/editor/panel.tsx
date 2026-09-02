'use client'

import { useScene } from '@pascal-app/core'
import { SegmentedControl, SliderControl, ToggleControl, useEditor } from '@pascal-app/editor'
import { useEffect } from 'react'
import { useViewer } from '@pascal-app/viewer'
import { usePoolStore } from './store'
import { POOL_SHAPE_OPTIONS, type PoolShape } from '../design/shapes'
import { getSkimmerPipeConnection } from '../skimmer/design/placement'
import { PoolSkimmerNode, type PoolSkimmerNode as PoolSkimmerNodeType } from '../skimmer/core/schema'
import type { PoolNode } from '../core/schema'
import { placementOnPoolWall } from '../skimmer/design/placement'
import { resolvePoolPolygon } from '../core/schema'
import { usePipeEditStore } from '../pipe/editor/store'
import { useValveEditStore } from '../valve/editor/store'

export default function PoolPanel() {
  const shape = usePoolStore((state) => state.shape)
  const copingStyle = usePoolStore((state) => state.copingStyle)
  const poolCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:pool').length)
  const pipeCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:pipe-network').length)
  const skimmerCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:skimmer').length)
  const selectedSkimmerId = useViewer((state) => state.selection.selectedIds.length === 1 ? state.selection.selectedIds[0] : null)
  const selectedSkimmer = useScene((state) => {
    const node = selectedSkimmerId ? (state.nodes as unknown as Record<string, unknown>)[selectedSkimmerId] : undefined
    return node && (node as { type?: unknown }).type === 'pool:skimmer' ? node as PoolSkimmerNodeType : null
  })
  const selectedSkimmerPool = useScene((state) => selectedSkimmer?.poolId ? (state.nodes as unknown as Record<string, PoolNode>)[selectedSkimmer.poolId] : undefined)
  const valveCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:valve').length)
  const valveVariant = useValveEditStore((state) => state.variant)
  const pumpCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:pump').length)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Alt' || event.repeat || event.metaKey || event.ctrlKey || event.shiftKey) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return
      event.preventDefault()
      useEditor.getState().cycleRotationAxis()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
  const activate = () => {
    useEditor.getState().setTool('pool:pool')
    useEditor.getState().setMode('build')
  }
  return (
    <div className="flex flex-col gap-4 p-4 text-sidebar-foreground">
      <header className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Swimming pools</h2>
        <span className="text-sidebar-foreground/60 text-xs">{poolCount} placed</span>
      </header>
      <p className="text-sidebar-foreground/60 text-xs">Choose a shape, then draw it on the ground. Custom and freeform modes stay editable after placement.</p>
      <PresetGrid selected={shape} onPick={(value) => { usePoolStore.getState().setShape(value); activate() }} />
      <SliderControl label="Length" min={0.5} max={100} step={0.1} unit="m" value={usePoolStore((state) => state.length)} onChange={usePoolStore.getState().setLength} />
      <SliderControl label="Width" min={0.5} max={100} step={0.1} unit="m" value={usePoolStore((state) => state.width)} onChange={usePoolStore.getState().setWidth} />
      <ToggleControl checked={usePoolStore((state) => state.floorProfile) === 'shallow-to-deep'} label="Shallow to deep" onChange={(enabled) => usePoolStore.getState().setFloorProfile(enabled ? 'shallow-to-deep' : 'flat')} />
      <SegmentedControl
        value={copingStyle}
        options={[{ label: 'Standard', value: 'continuous' }, { label: 'Rock border', value: 'rock' }]}
        onChange={usePoolStore.getState().setCopingStyle}
      />
      <section className="flex flex-col gap-2 border-t border-sidebar-border pt-4">
        <header className="flex items-center justify-between">
          <h3 className="font-medium text-sm">Pool plumbing</h3>
          <span className="text-sidebar-foreground/60 text-xs">{pipeCount} placed</span>
        </header>
        <button
          className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
          onClick={() => {
            useEditor.getState().setTool('pool:pipe-network')
            useEditor.getState().setMode('build')
          }}
          type="button"
        >
          <span className="block font-medium">PVC pipe</span>
          <span className="text-sidebar-foreground/60">Click a start and end point</span>
        </button>
        <button
          className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
          onClick={() => { useEditor.getState().setTool('pool:pump'); useEditor.getState().setMode('build') }}
          type="button"
        >
          <span className="block font-medium">Pool pump</span>
          <span className="text-sidebar-foreground/60">{pumpCount} placed · inlet and outlet ports</span>
        </button>
        <button
          className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
          onClick={() => { useEditor.getState().setTool('pool:valve'); useEditor.getState().setMode('build') }}
          type="button"
        >
          <span className="block font-medium">PVC suction valve</span>
          <span className="text-sidebar-foreground/60">{valveCount} placed · choose 2-way or 3-way</span>
        </button>
        <div className="grid grid-cols-2 gap-1" aria-label="Valve type">
          {([
            ['two-way', '2-way'],
            ['three-way', '3-way'],
          ] as const).map(([value, label]) => (
            <button
              className={`rounded border px-2 py-1 text-[11px] ${valveVariant === value ? 'border-primary' : 'border-sidebar-border'}`}
              key={value}
              onClick={() => useValveEditStore.getState().setVariant(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sidebar-foreground/60 text-[11px]">Alt switches the rotation axis · R rotates 90°</p>
        <button
          className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
          onClick={() => { useEditor.getState().setTool('pool:skimmer'); useEditor.getState().setMode('build') }}
          type="button"
        >
          <span className="block font-medium">Pool skimmer</span>
          <span className="text-sidebar-foreground/60">{skimmerCount} placed · click the pool wall</span>
        </button>
        {selectedSkimmer && <button
          className="rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-left text-xs hover:border-emerald-400"
          onClick={() => {
            const connection = getSkimmerPipeConnection(selectedSkimmer)
            usePipeEditStore.getState().beginDrawingFrom(connection.position, connection.direction)
            useEditor.getState().setTool('pool:pipe-network')
            useEditor.getState().setMode('build')
          }}
          type="button"
        >
          <span className="block font-medium">Connect PVC</span>
          <span className="text-sidebar-foreground/60">Start at this skimmer’s suction port</span>
        </button>}
        {selectedSkimmer && <section className="flex flex-col gap-2 rounded border border-sidebar-border p-2">
          <span className="text-xs font-medium">Skimmer settings</span>
          <SegmentedControl
            value={selectedSkimmer.style}
            options={[{ label: 'Standard', value: 'standard' }, { label: 'Wide', value: 'wide-mouth' }, { label: 'Corner', value: 'corner' }]}
            onChange={(value) => useScene.getState().updateNode(selectedSkimmer.id as never, { style: value } as never)}
          />
          <SegmentedControl
            value={selectedSkimmer.accessState}
            options={[{ label: 'Closed', value: 'closed' }, { label: 'Open basket', value: 'open' }]}
            onChange={(value) => useScene.getState().updateNode(selectedSkimmer.id as never, { accessState: value } as never)}
          />
          <ToggleControl checked={selectedSkimmer.showFlow} label="Show water flow" onChange={(enabled) => useScene.getState().updateNode(selectedSkimmer.id as never, { showFlow: enabled } as never)} />
          {selectedSkimmerPool && <button
            className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
            onClick={() => {
              const polygon = resolvePoolPolygon(selectedSkimmerPool)
              const oppositeWall = (selectedSkimmer.wallIndex + Math.floor(polygon.length / 2)) % polygon.length
              const placement = placementOnPoolWall(selectedSkimmerPool, oppositeWall, selectedSkimmer.wallT)
              if (!placement) return
              const duplicate = PoolSkimmerNode.parse({ ...selectedSkimmer, id: undefined, name: `${selectedSkimmer.name ?? 'Pool Skimmer'} (opposite wall)`, poolId: selectedSkimmerPool.id, wallIndex: placement.wallIndex, wallT: placement.wallT, position: placement.position, rotation: placement.rotation })
              useScene.getState().createNode(duplicate as never, (selectedSkimmer.parentId ?? selectedSkimmerPool.parentId ?? null) as never)
              useViewer.getState().setSelection({ selectedIds: [duplicate.id] })
            }}
            type="button"
          >
            <span className="block font-medium">Duplicate to opposite wall</span>
            <span className="text-sidebar-foreground/60">Create a matching skimmer across the pool</span>
          </button>}
        </section>}
      </section>
    </div>
  )
}

function PresetGrid({ selected, onPick }: { selected: PoolShape; onPick: (shape: PoolShape) => void }) {
  return <div className="grid grid-cols-2 gap-2">{POOL_SHAPE_OPTIONS.map((option) => <button className={`rounded border px-2 py-2 text-left text-xs ${selected === option.value ? 'border-primary' : 'border-sidebar-border'}`} key={option.value} onClick={() => onPick(option.value)} type="button">{option.label}</button>)}</div>
}
