'use client'

import { useScene } from '@pascal-app/core'
import { SegmentedControl, SliderControl, ToggleControl, useEditor } from '@pascal-app/editor'
import { usePoolStore } from './store'
import { POOL_SHAPE_OPTIONS, type PoolShape } from '../design/shapes'

export default function PoolPanel() {
  const shape = usePoolStore((state) => state.shape)
  const count = useScene((state) => Object.values(state.nodes).filter((node) => (node as { type?: string }).type === 'pool:pool').length)
  const activate = () => {
    useEditor.getState().setTool('pool:pool')
    useEditor.getState().setMode('build')
  }
  return (
    <div className="flex flex-col gap-4 p-4 text-sidebar-foreground">
      <header className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Swimming pools</h2>
        <span className="text-sidebar-foreground/60 text-xs">{count} placed</span>
      </header>
      <p className="text-sidebar-foreground/60 text-xs">Choose a shape, then draw it on the ground. Custom and freeform modes stay editable after placement.</p>
      <PresetGrid selected={shape} onPick={(value) => { usePoolStore.getState().setShape(value); activate() }} />
      <SliderControl label="Length" min={0.5} max={100} step={0.1} unit="m" value={usePoolStore((state) => state.length)} onChange={usePoolStore.getState().setLength} />
      <SliderControl label="Width" min={0.5} max={100} step={0.1} unit="m" value={usePoolStore((state) => state.width)} onChange={usePoolStore.getState().setWidth} />
      <ToggleControl checked={usePoolStore((state) => state.floorProfile) === 'shallow-to-deep'} label="Shallow to deep" onChange={(enabled) => usePoolStore.getState().setFloorProfile(enabled ? 'shallow-to-deep' : 'flat')} />
    </div>
  )
}

function PresetGrid({ selected, onPick }: { selected: PoolShape; onPick: (shape: PoolShape) => void }) {
  return <div className="grid grid-cols-2 gap-2">{POOL_SHAPE_OPTIONS.map((option) => <button className={`rounded border px-2 py-2 text-left text-xs ${selected === option.value ? 'border-primary' : 'border-sidebar-border'}`} key={option.value} onClick={() => onPick(option.value)} type="button">{option.label}</button>)}</div>
}
