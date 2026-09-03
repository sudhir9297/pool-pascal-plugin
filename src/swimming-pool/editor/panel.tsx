'use client'

import { useScene } from '@pascal-app/core'
import { SegmentedControl, SliderControl, ToggleControl, useEditor } from '@pascal-app/editor'
import { useEffect } from 'react'
import { usePoolStore } from './store'
import { POOL_SHAPE_OPTIONS, type PoolShape } from '../design/shapes'
import { POOL_STAIR_CATALOG, POOL_STAIR_VARIANTS, type PoolStairVariant } from '../stair/data/catalog'
import { usePoolStairStore } from '../stair/editor/store'

export default function PoolPanel() {
  const shape = usePoolStore((state) => state.shape)
  const copingStyle = usePoolStore((state) => state.copingStyle)
  const stairVariant = usePoolStairStore((state) => state.variant)
  const poolCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:pool').length)
  const pipeCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:pipe-network').length)
  const skimmerCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:skimmer').length)
  const inletCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:inlet').length)
  const valveCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:valve').length)
  const pumpCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:pump').length)
  const filterCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:filter').length)
  const heaterCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:heater').length)
  const drainCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:drain').length)
  const catchBasinCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:catch-basin').length)
  const watercourseCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:watercourse').length)
  const waterfallCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:waterfall').length)
  const spilloverCount = useScene((state) => Object.values(state.nodes).filter((node) => String((node as unknown as { type?: unknown }).type) === 'pool:spillover').length)
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
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain p-4 text-sidebar-foreground">
      <header className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Swimming pools</h2>
        <span className="text-sidebar-foreground/60 text-xs">{poolCount} placed</span>
      </header>
      <p className="text-sidebar-foreground/60 text-xs">Choose a shape, then draw it on the ground. Custom and freeform modes stay editable after placement.</p>
      <PresetGrid selected={shape} onPick={(value) => { usePoolStore.getState().setShape(value); activate() }} />
      <section className="flex flex-col gap-2 border-t border-sidebar-border pt-4">
        <h3 className="font-medium text-sm">Pool access</h3>
        <StairPresetGrid
          selected={stairVariant}
          onPick={(variant) => {
            usePoolStairStore.getState().selectVariant(variant)
            useEditor.getState().setTool('pool:stair')
            useEditor.getState().setMode('build')
          }}
        />
      </section>
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
          <h3 className="font-medium text-sm">Natural water feature</h3>
          <span className="text-sidebar-foreground/60 text-xs">{catchBasinCount} placed</span>
        </header>
        <button
          className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
          onClick={() => { useEditor.getState().setTool('pool:catch-basin'); useEditor.getState().setMode('build') }}
          type="button"
        >
          <span className="block font-medium">Lower catch basin</span>
          <span className="text-sidebar-foreground/60">Rock-lined secondary water feature</span>
        </button>
        <button
          className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
          onClick={() => { useEditor.getState().setTool('pool:watercourse'); useEditor.getState().setMode('build') }}
          type="button"
        >
          <span className="block font-medium">Rock watercourse</span>
          <span className="text-sidebar-foreground/60">{watercourseCount} placed · connecting channel</span>
        </button>
        <button
          className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
          onClick={() => { useEditor.getState().setTool('pool:waterfall'); useEditor.getState().setMode('build') }}
          type="button"
        >
          <span className="block font-medium">Waterfall</span>
          <span className="text-sidebar-foreground/60">{waterfallCount} placed · low-poly rock cascade</span>
        </button>
        <button
          className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
          onClick={() => { useEditor.getState().setTool('pool:spillover'); useEditor.getState().setMode('build') }}
          type="button"
        >
          <span className="block font-medium">Pool spillover</span>
          <span className="text-sidebar-foreground/60">{spilloverCount} placed · click higher pool, then lower pool</span>
        </button>
      </section>
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
          <span className="text-sidebar-foreground/60">Draw, then extend from the + handle</span>
        </button>
        <button
          className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
          onClick={() => { useEditor.getState().setTool('pool:filter'); useEditor.getState().setMode('build') }}
          type="button"
        >
          <span className="block font-medium">Pool filter</span>
          <span className="text-sidebar-foreground/60">{filterCount} placed · tank, gauge, valve, and ports</span>
        </button>
        <button
          className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
          onClick={() => { useEditor.getState().setTool('pool:heater'); useEditor.getState().setMode('build') }}
          type="button"
        >
          <span className="block font-medium">Pool heater</span>
          <span className="text-sidebar-foreground/60">{heaterCount} placed · inlet, outlet, and exhaust</span>
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
          onClick={() => { useEditor.getState().setTool('pool:drain'); useEditor.getState().setMode('build') }}
          type="button"
        >
          <span className="block font-medium">Pool drain</span>
          <span className="text-sidebar-foreground/60">{drainCount} placed · click inside a pool to snap to its floor</span>
        </button>
        <button
          className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
          onClick={() => { useEditor.getState().setTool('pool:valve'); useEditor.getState().setMode('build') }}
          type="button"
        >
          <span className="block font-medium">PVC suction valve</span>
          <span className="text-sidebar-foreground/60">{valveCount} placed · click to place</span>
        </button>
        <p className="text-sidebar-foreground/60 text-[11px]">Alt switches the rotation axis · R rotates 90°</p>
        <button
          className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
          onClick={() => { useEditor.getState().setTool('pool:skimmer'); useEditor.getState().setMode('build') }}
          type="button"
        >
          <span className="block font-medium">Pool skimmer</span>
          <span className="text-sidebar-foreground/60">{skimmerCount} placed · click the pool wall</span>
        </button>
        <button
          className="rounded border border-sidebar-border px-3 py-2 text-left text-xs hover:border-primary"
          onClick={() => { useEditor.getState().setTool('pool:inlet'); useEditor.getState().setMode('build') }}
          type="button"
        >
          <span className="block font-medium">Pool return inlet</span>
          <span className="text-sidebar-foreground/60">{inletCount} placed · click the pool wall</span>
        </button>
      </section>
    </div>
  )
}

function PresetGrid({ selected, onPick }: { selected: PoolShape; onPick: (shape: PoolShape) => void }) {
  return <div className="grid grid-cols-2 gap-2">{POOL_SHAPE_OPTIONS.map((option) => <button className={`rounded border px-2 py-2 text-left text-xs ${selected === option.value ? 'border-primary' : 'border-sidebar-border'}`} key={option.value} onClick={() => onPick(option.value)} type="button">{option.label}</button>)}</div>
}

function StairPresetGrid({ selected, onPick }: { selected: PoolStairVariant; onPick: (variant: PoolStairVariant) => void }) {
  return <div className="grid grid-cols-2 gap-2">{POOL_STAIR_VARIANTS.map((variant) => {
    const preset = POOL_STAIR_CATALOG[variant]
    return <button className={`rounded border px-2 py-2 text-left text-xs ${selected === variant ? 'border-primary' : 'border-sidebar-border'}`} key={variant} onClick={() => onPick(variant)} type="button">
      <span className="block font-medium">{preset.label}</span>
    </button>
  })}</div>
}
