import { expect, test } from 'bun:test'

test('pool design steps navigate without changing the active editor tool', async () => {
  // Isolate hook mocks so other tests retain the real React and editor stores.
  const panelPath = import.meta.resolve('./panel')
  const shellPath = import.meta.resolve('./shell-settings')
  const systemsPath = import.meta.resolve('./systems-panel')
  const reviewPath = import.meta.resolve('./review-panel')
  const selectionPath = import.meta.resolve('./pool-selection')
  const fittingPath = import.meta.resolve('../design/pool-fitting-layout')
  const outlinePath = import.meta.resolve('./outline-control-state')
  const sectionPath = import.meta.resolve('./pool-section-bar')
  const process = Bun.spawn([Bun.which('bun')!, '-e', `
    import { mock } from 'bun:test'
    import * as React from 'react'
    let step = 'shell'
    let pool = null
    const editor = { mode: 'select', tool: null, cycleRotationAxis() {}, setTool: tool => { editor.tool = tool }, setMode: mode => { editor.mode = mode } }
    const useEditor = Object.assign(selector => selector(editor), { getState: () => editor })
    mock.module('react', () => ({
      ...React,
      useEffect() {},
      useMemo: callback => callback(),
      useState: () => [step, next => { step = next }],
    }))
    mock.module('@pascal-app/core', () => ({ useScene: selector => selector({ nodes: {} }) }))
    const viewer = { selection: { selectedIds: [], levelId: null }, setSelection: () => { pool = null } }
    mock.module('@pascal-app/viewer', () => ({ useViewer: Object.assign(selector => selector(viewer), { getState: () => viewer }) }))
    mock.module('@pascal-app/editor', () => ({ useEditor }))
    mock.module(${JSON.stringify(outlinePath)}, () => ({ usePoolOutlineControls: () => ({ nodeId: null, showAll: false }) }))
    mock.module(${JSON.stringify(shellPath)}, () => ({ PoolShellSettings() {} }))
    mock.module(${JSON.stringify(systemsPath)}, () => ({ PoolSystemsPanel() {} }))
    mock.module(${JSON.stringify(reviewPath)}, () => ({ PoolReviewPanel() {} }))
    mock.module(${JSON.stringify(selectionPath)}, () => ({ getExplicitlySelectedPool: () => pool }))
    mock.module(${JSON.stringify(fittingPath)}, () => ({ planPoolFittings: () => null }))
    mock.module(${JSON.stringify(sectionPath)}, () => ({ PoolSectionBarPortal() {} }))
    const { default: Panel } = await import(${JSON.stringify(panelPath)})
    function findAll(element, predicate) {
      if (!element || typeof element !== 'object') return []
      return [...(predicate(element) ? [element] : []),
        ...[element.props?.children].flat(Infinity).flatMap(child => findAll(child, predicate))]
    }
    let tabs = findAll(Panel(), element => element.props?.role === 'tab')
    if (tabs.length !== 3 || tabs[0].props['aria-selected'] !== true) throw new Error('Shell step is not active')
    tabs[1].props.onClick()
    tabs = findAll(Panel(), element => element.props?.role === 'tab')
    if (step !== 'systems' || tabs[1].props['aria-selected'] !== true) throw new Error('Systems step did not open')
    pool = { id: 'pool_test', name: 'Swimming Pool 1', shape: 'rectangle' }
    if (!findAll(Panel(), element => element.props?.children === 'Editing Swimming Pool 1').length) throw new Error('Editing state is not visible')
    const add = findAll(Panel(), element => element.props?.children === 'Add new pool')[0]
    add.props.onClick()
    if (pool || editor.tool || editor.mode !== 'select' || step !== 'shell') throw new Error('Add new pool did not open a passive draft')
    if (!findAll(Panel(), element => element.props?.children === 'New pool').length) throw new Error('New state is not visible')
    editor.mode = 'build'; editor.tool = 'pool:pool'
    if (!findAll(Panel(), element => element.props?.children === 'Placing a new pool').length) throw new Error('Placement state is not visible')
  `], { stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stderr] = await Promise.all([process.exited, new Response(process.stderr).text()])
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
