'use client'

import { useScene } from '@pascal-app/core'
import { SegmentedControl, SliderControl, ToggleControl, useEditor } from '@pascal-app/editor'
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { usePoolStore } from './store'
import { POOL_SHAPE_OPTIONS, type PoolShape } from '../design/shapes'
import { POOL_STAIR_CATALOG, POOL_STAIR_VARIANTS, type PoolStairVariant } from '../stair/data/catalog'
import { usePoolStairStore } from '../stair/editor/store'
import { countPoolPluginNodes } from './scene-nodes'

const THUMBNAILS = {
  pool: new URL('./assets/swimming-pool-thumbnail-v2.webp', import.meta.url).href,
  stairs: new URL('./assets/pool-stairs-thumbnail.webp', import.meta.url).href,
  waterfall: new URL('./assets/waterfall-thumbnail.webp', import.meta.url).href,
  spillover: new URL('./assets/spillover-thumbnail.webp', import.meta.url).href,
  filter: new URL('./assets/filter-thumbnail.webp', import.meta.url).href,
  heater: new URL('./assets/heater-thumbnail.webp', import.meta.url).href,
  pump: new URL('./assets/pump-thumbnail.webp', import.meta.url).href,
  drain: new URL('./assets/drain-thumbnail.webp', import.meta.url).href,
  valve: new URL('./assets/valve-thumbnail.webp', import.meta.url).href,
  skimmer: new URL('./assets/skimmer-thumbnail.webp', import.meta.url).href,
  inlet: new URL('./assets/inlet-thumbnail.webp', import.meta.url).href,
} as const

const POOL_SHAPE_THUMBNAILS: Record<PoolShape, string> = {
  circle: new URL('./assets/pool-circle-thumbnail.webp', import.meta.url).href,
  rectangle: new URL('./assets/pool-rectangle-thumbnail.webp', import.meta.url).href,
  'lap-rectangle': new URL('./assets/pool-lap-rectangle-thumbnail.webp', import.meta.url).href,
  kidney: new URL('./assets/pool-kidney-thumbnail-v3.webp', import.meta.url).href,
  lagoon: new URL('./assets/pool-lagoon-thumbnail.webp', import.meta.url).href,
  roman: new URL('./assets/pool-roman-thumbnail-v3.webp', import.meta.url).href,
  'l-shape': new URL('./assets/pool-l-shape-thumbnail.webp', import.meta.url).href,
  spline: new URL('./assets/pool-freehand-thumbnail.webp', import.meta.url).href,
  custom: new URL('./assets/pool-custom-thumbnail.webp', import.meta.url).href,
}

const POOL_STAIR_THUMBNAILS: Record<PoolStairVariant, string> = {
  extended: new URL('./assets/stair-tall-angled-thumbnail-v3.webp', import.meta.url).href,
  classic: new URL('./assets/stair-round-arch-thumbnail-v3.webp', import.meta.url).href,
  square: new URL('./assets/stair-low-square-thumbnail-v3.webp', import.meta.url).href,
  compact: new URL('./assets/stair-short-compact-thumbnail-v3.webp', import.meta.url).href,
}

export default function PoolPanel() {
  const [menu, setMenu] = useState<'root' | 'pool-types' | 'stair-types'>('root')
  const shape = usePoolStore((state) => state.shape)
  const copingStyle = usePoolStore((state) => state.copingStyle)
  const floorProfile = usePoolStore((state) => state.floorProfile)
  const length = usePoolStore((state) => state.length)
  const width = usePoolStore((state) => state.width)
  const stairVariant = usePoolStairStore((state) => state.variant)
  const counts = useScene(useShallow((state) => countPoolPluginNodes(state.nodes)))
  const poolCount = counts['pool:pool']
  const stairCount = counts['pool:stair']
  const skimmerCount = counts['pool:skimmer']
  const inletCount = counts['pool:inlet']
  const valveCount = counts['pool:valve']
  const pumpCount = counts['pool:pump']
  const filterCount = counts['pool:filter']
  const heaterCount = counts['pool:heater']
  const drainCount = counts['pool:drain']
  const waterfallCount = counts['pool:waterfall']
  const spilloverCount = counts['pool:spillover']
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
  const activateTool = (tool: 'pool:pool' | 'pool:waterfall' | 'pool:spillover' | 'pool:filter' | 'pool:heater' | 'pool:pump' | 'pool:drain' | 'pool:valve' | 'pool:skimmer' | 'pool:inlet') => {
    useEditor.getState().setTool(tool)
    useEditor.getState().setMode('build')
  }
  const activate = () => activateTool('pool:pool')

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain p-4 text-sidebar-foreground">
      {menu === 'root' && <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-base">Pool catalog</h2>
        <div className="grid grid-cols-2 gap-2">
          <CatalogCard className="col-span-2" count={poolCount} image={THUMBNAILS.pool} label="Swimming pool" onClick={() => { setMenu('pool-types'); activate() }} wide />
          <CatalogCard count={stairCount} image={THUMBNAILS.stairs} label="Pool stairs" onClick={() => setMenu('stair-types')} />
        </div>
      </section>}
      {menu !== 'root' && <header className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <button
            aria-label="Back to pool catalog"
            className="rounded px-1 text-lg leading-none text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={() => setMenu('root')}
            type="button"
          >
            ←
          </button>
          <h2 className="font-semibold text-base">{menu === 'pool-types' ? 'Swimming pool' : menu === 'stair-types' ? 'Pool stairs' : 'Swimming pools'}</h2>
        </div>
        <span className="text-sidebar-foreground/60 text-xs">{menu === 'stair-types' ? stairCount : poolCount} placed</span>
      </header>}
      {menu === 'pool-types' && <PresetGrid selected={shape} onPick={(value) => { usePoolStore.getState().setShape(value); activate() }} />}
      {menu === 'pool-types' && <section className="flex flex-col gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/20 p-3">
        <h3 className="font-medium text-sm">Pool settings</h3>
        <div className="flex flex-col gap-1.5">
          <span className="text-sidebar-foreground/60 text-xs">Border style</span>
          <SegmentedControl
            className="h-11 p-1"
            value={copingStyle}
            options={[{ label: 'Standard', value: 'continuous' }, { label: 'Rock border', value: 'rock' }]}
            onChange={usePoolStore.getState().setCopingStyle}
          />
        </div>
        <ToggleControl
          checked={floorProfile === 'shallow-to-deep'}
          className="h-11 px-4"
          label="Shallow to deep"
          onChange={(enabled) => usePoolStore.getState().setFloorProfile(enabled ? 'shallow-to-deep' : 'flat')}
        />
      </section>}
      {menu === 'stair-types' && <section className="flex flex-col gap-2">
        <h3 className="font-medium text-sm">Pool stairs</h3>
        <StairPresetGrid
          selected={stairVariant}
          onPick={(variant) => {
            usePoolStairStore.getState().selectVariant(variant)
            useEditor.getState().setTool('pool:stair')
            useEditor.getState().setMode('build')
          }}
        />
      </section>}
      {menu === 'pool-types' && <SliderControl label={shape === 'circle' ? 'Diameter' : 'Length'} min={0.5} max={100} step={0.1} unit="m" value={length} onChange={usePoolStore.getState().setLength} />}
      {menu === 'pool-types' && shape !== 'circle' && <SliderControl label="Width" min={0.5} max={100} step={0.1} unit="m" value={width} onChange={usePoolStore.getState().setWidth} />}
      {menu === 'root' && <section className="flex flex-col gap-2 border-t border-sidebar-border pt-4">
        <h3 className="font-medium text-sm uppercase tracking-wide text-sidebar-foreground/60">Natural water features</h3>
        <div className="grid grid-cols-2 gap-2">
          <CatalogCard count={waterfallCount} image={THUMBNAILS.waterfall} label="Waterfall" onClick={() => activateTool('pool:waterfall')} />
          <CatalogCard count={spilloverCount} image={THUMBNAILS.spillover} label="Pool spillover" onClick={() => activateTool('pool:spillover')} />
        </div>
      </section>}
      {menu === 'root' && <section className="flex flex-col gap-2 border-t border-sidebar-border pt-4">
        <h3 className="font-medium text-sm uppercase tracking-wide text-sidebar-foreground/60">Pool equipment</h3>
        <div className="grid grid-cols-2 gap-2">
          <CatalogCard count={filterCount} image={THUMBNAILS.filter} label="Pool filter" onClick={() => activateTool('pool:filter')} />
          <CatalogCard count={heaterCount} image={THUMBNAILS.heater} label="Pool heater" onClick={() => activateTool('pool:heater')} />
          <CatalogCard count={pumpCount} image={THUMBNAILS.pump} label="Pool pump" onClick={() => activateTool('pool:pump')} />
          <CatalogCard count={drainCount} image={THUMBNAILS.drain} label="Pool drain" onClick={() => activateTool('pool:drain')} />
          <CatalogCard count={valveCount} image={THUMBNAILS.valve} label="Suction valve" onClick={() => activateTool('pool:valve')} />
          <CatalogCard count={skimmerCount} image={THUMBNAILS.skimmer} label="Pool skimmer" onClick={() => activateTool('pool:skimmer')} />
          <CatalogCard count={inletCount} image={THUMBNAILS.inlet} label="Pool return inlet" onClick={() => activateTool('pool:inlet')} />
        </div>
      </section>}
    </div>
  )
}

function PresetGrid({ selected, onPick }: { selected: PoolShape; onPick: (shape: PoolShape) => void }) {
  return <div className="grid grid-cols-2 gap-2">{POOL_SHAPE_OPTIONS.map((option) => <button
    aria-pressed={selected === option.value}
    className={`group min-w-0 overflow-hidden rounded-xl border bg-sidebar-accent/20 text-left ${selected === option.value ? 'border-primary ring-1 ring-primary/30' : 'border-sidebar-border hover:border-primary'}`}
    key={option.value}
    onClick={() => onPick(option.value)}
    type="button"
  >
    <div className="overflow-hidden">
      <img alt="" className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" src={POOL_SHAPE_THUMBNAILS[option.value]} />
    </div>
    <span className="block truncate px-2 py-2 font-medium text-xs">{option.label}</span>
  </button>)}</div>
}

function StairPresetGrid({ selected, onPick }: { selected: PoolStairVariant; onPick: (variant: PoolStairVariant) => void }) {
  return <div className="grid grid-cols-2 gap-2">{POOL_STAIR_VARIANTS.map((variant) => {
    const preset = POOL_STAIR_CATALOG[variant]
    return <button
      aria-pressed={selected === variant}
      className={`group min-w-0 overflow-hidden rounded-xl border bg-sidebar-accent/20 text-left ${selected === variant ? 'border-primary ring-1 ring-primary/30' : 'border-sidebar-border hover:border-primary'}`}
      key={variant}
      onClick={() => onPick(variant)}
      type="button"
    >
      <div className="overflow-hidden">
        <img alt="" className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" src={POOL_STAIR_THUMBNAILS[variant]} />
      </div>
      <span className="block truncate px-2 py-2 font-medium text-xs">{preset.label}</span>
    </button>
  })}</div>
}

function CatalogCard({ className = '', count, image, label, onClick, wide = false }: {
  className?: string
  count: number
  image: string
  label: string
  onClick: () => void
  wide?: boolean
}) {
  return <button className={`group min-w-0 overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-accent/20 text-left hover:border-primary ${className}`} onClick={onClick} type="button">
    <div className="overflow-hidden">
      <img alt="" className={`${wide ? 'aspect-[2.4/1]' : 'aspect-square'} w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]`} src={image} />
    </div>
    <span className="flex min-w-0 items-center justify-between gap-2 px-2 py-2">
      <span className="truncate font-medium text-xs">{label}</span>
      <span className="shrink-0 text-sidebar-foreground/50 text-[11px]">{count}</span>
    </span>
  </button>
}
