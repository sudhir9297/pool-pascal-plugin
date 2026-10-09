'use client'

import { type AnyNodeId, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { useEffect, useState } from 'react'
import { useEditor } from '@pascal-app/editor'
import { PoolShellSettings } from './shell-settings'
import { PoolSystemsPanel } from './systems-panel'
import { PoolReviewPanel } from './review-panel'
import { getExplicitlySelectedPool } from './pool-selection'

import { usePoolOutlineControls } from './outline-control-state'

export default function PoolPanel() {
  const outlineControls = usePoolOutlineControls()
  const [step, setStep] = useState<'shell' | 'systems' | 'review'>('shell')
  const drawingPool = useEditor((state) => state.mode === 'build' && state.tool === 'pool:pool')
  const selectedIds = useViewer((state) => state.selection.selectedIds)
  const activeLevelId = useViewer((state) => state.selection.levelId)
  const pool = useScene((state) => getExplicitlySelectedPool(state.nodes, selectedIds))
  const activeLevelName = useScene((state) => {
    const levelId = (!drawingPool && pool?.parentId) || activeLevelId
    const level = levelId ? state.nodes[levelId as keyof typeof state.nodes] : null
    if (!level || level.type !== 'level') return null
    return level.name || (level.level === 0 ? 'Ground floor' : `Level ${level.level}`)
  })

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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden text-sidebar-foreground">
      <header className="flex shrink-0 flex-col gap-3 border-b border-sidebar-border/70 px-3 pb-3 pt-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-base">Pool design</h2>
          <p className="mt-0.5 truncate text-xs font-medium text-sidebar-foreground/80">
            {drawingPool ? 'Placing a new pool' : pool ? `Editing ${pool.name || 'Swimming pool'}` : 'New pool'}
          </p>
          {pool && !drawingPool && <button type="button" className="mt-2 rounded-lg border border-sidebar-border px-3 py-2 text-xs font-medium hover:bg-sidebar-accent" onClick={() => {
            useEditor.getState().setTool(null)
            useEditor.getState().setMode('select')
            useViewer.getState().setSelection({ selectedIds: [] })
            setStep('shell')
          }}>Add new pool</button>}
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-sidebar-foreground/55">
            <span className="min-w-0 truncate">
              <span aria-hidden="true" className={`mr-1.5 inline-block size-1.5 rounded-full ${activeLevelName ? 'bg-emerald-400' : 'bg-sidebar-foreground/35'}`} />
              {activeLevelName ?? 'No floor selected'}
            </span>
          </div>
        </div>
        <div aria-label="Pool design steps" className="grid grid-cols-3 rounded-xl bg-sidebar-accent/30 p-1" role="tablist">
          <button aria-selected={step === 'shell'} className={`min-h-9 rounded-lg px-2 text-xs font-medium transition-colors ${step === 'shell' ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm ring-1 ring-sidebar-foreground/35' : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`} onClick={() => setStep('shell')} role="tab" type="button">
            Shell
          </button>
          <button aria-selected={step === 'systems'} className={`min-h-9 rounded-lg px-2 text-xs font-medium transition-colors ${step === 'systems' ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm ring-1 ring-sidebar-foreground/35' : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`} onClick={() => setStep('systems')} role="tab" type="button">
            Systems
          </button>
          <button aria-selected={step === 'review'} className={`min-h-9 rounded-lg px-2 text-xs font-medium transition-colors ${step === 'review' ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm ring-1 ring-sidebar-foreground/35' : 'text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'}`} onClick={() => setStep('review')} role="tab" type="button">
            Review
          </button>
        </div>
      </header>
      {step === 'shell' && pool && (pool.shape === 'spline' || pool.shape === 'custom') && <label className="flex shrink-0 items-center gap-2 border-b border-sidebar-border/70 px-3 py-2 text-xs">
        <input type="checkbox" checked={outlineControls.nodeId === pool.id && outlineControls.showAll}
          onChange={(event) => {
            outlineControls.setShowAll(pool.id, event.target.checked)
            useScene.getState().markDirty(pool.id as AnyNodeId)
          }} />
        Show all outline points
      </label>}
      {step === 'shell' ? <PoolShellSettings /> : step === 'systems' ? <PoolSystemsPanel /> : <PoolReviewPanel onOpenShell={() => setStep('shell')} onOpenSystems={() => setStep('systems')} />}
    </div>
  )
}
