'use client'

import { useScene } from '@pascal-app/core'
import { SegmentedControl, SliderControl, ToggleControl, useEditor } from '@pascal-app/editor'
import { HOT_TUB_PRESET_LIST } from './hotTub-presets'
import type { HotTubPreset } from './hotTub-schema'
import { WATER_FEATURE_PRESET_LIST } from './waterFeatures-presets'
import type { WaterFeaturesPreset } from './waterFeatures-schema'
import { POOL_PRESET_LIST } from './presets'
import type { PoolPreset } from './schema'
import { type PoolsPanelMode as Mode, usePoolsStore } from './store'

const KIND: Record<Mode, string> = {
  pools: 'pools:pool',
  hotTubs: 'pools:hotTub',
  waterFeatures: 'pools:waterFeatures',
}
const NOUN: Record<Mode, string> = { pools: 'pool', hotTubs: 'hotTub', waterFeatures: 'waterFeatures' }

const setPluginTool = (tool: string) => {
  const setTool = useEditor.getState().setTool as (value: string) => void
  setTool(tool)
}

/**
 * The plugin's left-rail panel. A Pools / HotTubs / WaterFeatures segmented control
 * switches the brush; picking a preset arms placement for that kind
 * (`setTool('pools:*')` + build mode). The count chip reads the scene reactively,
 * closing the triangle: panel → store → tool → scene → panel. It composes the
 * host's exported controls (`SegmentedControl`/`SliderControl`/`ToggleControl`)
 * so the brush matches the right-hand inspector pixel-for-pixel.
 */
export default function PoolsPanel() {
  // Section lives in the plugin store (not local state) so "find in catalog"
  // can point the panel at the found node's section — see find-sync.ts.
  const mode = usePoolsStore((s) => s.mode)
  const setMode = usePoolsStore((s) => s.setMode)
  const activeTool = useEditor((s) => s.tool)
  const count = useScene(
    (s) => Object.values(s.nodes).filter((n) => (n.type as string) === KIND[mode]).length,
  )

  const arming = activeTool === KIND[mode]

  return (
    <div className="flex flex-col gap-4 p-4 text-sidebar-foreground">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Pool</h2>
          <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-sidebar-foreground/70 text-xs">
            {count} placed
          </span>
        </div>
        <SegmentedControl
          onChange={setMode}
          options={[
            { label: 'Pools', value: 'pools' },
            { label: 'HotTubs', value: 'hotTubs' },
            { label: 'WaterFeatures', value: 'waterFeatures' },
          ]}
          value={mode}
        />
        <p className="text-sidebar-foreground/50 text-xs">
          {arming
            ? 'Click the ground to feature. Press Esc to stop.'
            : `Pick ${mode === 'waterFeatures' ? 'a waterFeatures' : `a ${NOUN[mode]}`}, then click the ground.`}
        </p>
      </header>

      {mode === 'pools' && <PoolsSection arming={arming} />}
      {mode === 'hotTubs' && <HotTubsSection arming={arming} />}
      {mode === 'waterFeatures' && <WaterFeaturesSection arming={arming} />}

      <footer className="-mx-4 -mb-4 sticky bottom-0 mt-1 border-sidebar-border/50 border-t bg-sidebar px-4 py-3 text-[11px] text-sidebar-foreground/50 leading-relaxed">
        Pools generated with{' '}
        <a
          className="underline decoration-dotted underline-offset-2 hover:text-sidebar-foreground/70"
          href="https://github.com/dgreenheck/ez-tree"
          rel="noreferrer"
          target="_blank"
        >
          procedural geometry
        </a>{' '}
        by{' '}
        <a
          className="underline decoration-dotted underline-offset-2 hover:text-sidebar-foreground/70"
          href="https://x.com/dangreenheck"
          rel="noreferrer"
          target="_blank"
        >
          Daniel Greenheck
        </a>{' '}
        (MIT).
      </footer>
    </div>
  )
}

function PoolsSection({ arming }: { arming: boolean }) {
  const selected = usePoolsStore((s) => s.preset)
  const size = usePoolsStore((s) => s.size)
  const height = usePoolsStore((s) => s.height)
  const detailDensity = usePoolsStore((s) => s.detailDensity)
  const wallThickness = usePoolsStore((s) => s.wallThickness)
  const minimal = usePoolsStore((s) => s.minimal)

  const activate = (preset: PoolPreset) => {
    usePoolsStore.getState().setPreset(preset)
    setPluginTool('pools:pool')
    useEditor.getState().setMode('build')
  }

  return (
    <>
      <PresetGrid items={POOL_PRESET_LIST} onPick={activate} selected={arming ? selected : null} />
      {selected !== 'spa' && (
        <div className="flex flex-col gap-2">
          <SegmentedControl
            onChange={usePoolsStore.getState().setSize}
            options={[
              { label: 'S', value: 'small' },
              { label: 'M', value: 'medium' },
              { label: 'L', value: 'large' },
            ]}
            value={size}
          />
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        <SliderControl
          label="Height"
          max={15}
          min={1}
          onChange={usePoolsStore.getState().setHeight}
          precision={1}
          restoreOnCommit={false}
          step={0.5}
          unit="m"
          value={height}
        />
        {!minimal && (
          <SliderControl
            label="Pool detail"
            max={1.5}
            min={0}
            onChange={usePoolsStore.getState().setDetailDensity}
            precision={1}
            restoreOnCommit={false}
            step={0.1}
            value={detailDensity}
          />
        )}
        <SliderControl
          label="Wall thickness"
          max={2.5}
          min={0.3}
          onChange={usePoolsStore.getState().setWallThickness}
          precision={1}
          restoreOnCommit={false}
          step={0.1}
          value={wallThickness}
        />
        <ToggleControl
          checked={minimal}
          label="Minimal detail"
          onChange={usePoolsStore.getState().setMinimal}
        />
      </div>
    </>
  )
}

function HotTubsSection({ arming }: { arming: boolean }) {
  const selected = usePoolsStore((s) => s.hotTubPreset)
  const height = usePoolsStore((s) => s.hotTubHeight)

  const activate = (preset: HotTubPreset) => {
    usePoolsStore.getState().setHotTubPreset(preset)
    setPluginTool('pools:hotTub')
    useEditor.getState().setMode('build')
  }

  return (
    <>
      <PresetGrid
        items={HOT_TUB_PRESET_LIST}
        onPick={activate}
        selected={arming ? selected : null}
      />
      <SliderControl
        label="Height"
        max={2}
        min={0.2}
        onChange={usePoolsStore.getState().setHotTubHeight}
        precision={2}
        restoreOnCommit={false}
        step={0.05}
        unit="m"
        value={height}
      />
    </>
  )
}

function WaterFeaturesSection({ arming }: { arming: boolean }) {
  const selected = usePoolsStore((s) => s.waterFeaturesPreset)
  const height = usePoolsStore((s) => s.waterFeaturesHeight)

  const activate = (preset: WaterFeaturesPreset) => {
    usePoolsStore.getState().setWaterFeaturesPreset(preset)
    setPluginTool('pools:waterFeatures')
    useEditor.getState().setMode('build')
  }

  return (
    <>
      <PresetGrid items={WATER_FEATURE_PRESET_LIST} onPick={activate} selected={arming ? selected : null} />
      <SliderControl
        label="Height"
        max={2}
        min={0.1}
        onChange={usePoolsStore.getState().setWaterFeaturesHeight}
        precision={2}
        restoreOnCommit={false}
        step={0.05}
        unit="m"
        value={height}
      />
    </>
  )
}

function PresetGrid<T extends string>({
  items,
  selected,
  onPick,
}: {
  items: ReadonlyArray<{ id: T; label: string; thumbnail: string }>
  selected: T | null
  onPick: (id: T) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => {
        const isSelected = selected === item.id
        return (
          <button
            className={`group relative flex flex-col gap-2 rounded-xl border p-2 transition-all ${
              isSelected
                ? 'border-sidebar-ring bg-sidebar-accent shadow-sm'
                : 'border-sidebar-border hover:border-sidebar-ring/50 hover:bg-sidebar-accent/40'
            }`}
            key={item.id}
            onClick={() => onPick(item.id)}
            type="button"
          >
            <img
              alt=""
              aria-hidden
              className="aspect-square w-full rounded-lg bg-[#f3f4f6] object-cover ring-1 ring-black/10 transition-transform group-hover:scale-[1.02]"
              src={item.thumbnail}
            />
            <span className="pl-0.5 font-medium text-xs">{item.label}</span>
            {isSelected && (
              <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-sidebar-ring ring-2 ring-sidebar-accent" />
            )}
          </button>
        )
      })}
    </div>
  )
}
