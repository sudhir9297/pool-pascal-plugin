import { expect, test } from 'bun:test'

test('shape choices configure a draft or edit the selected pool; placement requires its own action', async () => {
  const script = `
    import { mock } from 'bun:test'
    import * as React from 'react'
    import * as Core from '@pascal-app/core'
    import { DEFAULT_POOL, PoolNode } from ${JSON.stringify(import.meta.resolve('../core/schema'))}
    let selectedIds = []
    const pool = PoolNode.parse({ id: 'pool_test', name: 'Swimming Pool 1' })
    const scene = { nodes: { [pool.id]: pool }, readOnly: false, updateNode: (id, patch) => { scene.nodes[id] = { ...scene.nodes[id], ...patch } } }
    const editor = { mode: 'select', tool: null, setTool: tool => { editor.tool = tool; editor.mode = 'build' } }
    let draft = { ...DEFAULT_POOL }
    mock.module('react', () => ({ ...React, useState: () => [true, () => {}], useRef: value => ({ current: value }) }))
    mock.module('zustand/react/shallow', () => ({ useShallow: selector => selector }))
    mock.module('@pascal-app/core', () => ({ ...Core, useScene: Object.assign(selector => selector(scene), { getState: () => scene }) }))
    mock.module('@pascal-app/viewer', () => ({ useViewer: selector => selector({ selection: { selectedIds, levelId: 'level_test' } }) }))
    mock.module('@pascal-app/editor', () => ({ ActionButton() {}, ActionGroup() {}, SliderControl() {}, ToggleControl() {}, useEditor: Object.assign(selector => selector(editor), { getState: () => editor }) }))
    mock.module(${JSON.stringify(import.meta.resolve('./store'))}, () => ({ usePoolStore: Object.assign(selector => selector(draft), { getState: () => draft, setState: patch => { draft = { ...draft, ...patch } } }) }))
    mock.module(${JSON.stringify(import.meta.resolve('./use-settings-edit'))}, () => ({ usePoolSettingsEdit: () => ({ patch: {}, previewing: { current: false } }) }))
    mock.module(${JSON.stringify(import.meta.resolve('./finish-setting'))}, () => ({ FinishSetting() {}, PoolFinishInspectorControl() {} }))
    mock.module(${JSON.stringify(import.meta.resolve('./water-preset-setting'))}, () => ({ WaterPresetSetting() {}, PoolWaterPresetInspectorControl() {} }))
    const { PoolShellSettings } = await import(${JSON.stringify(import.meta.resolve('./shell-settings'))})
    function find(element, predicate) {
      if (!element || typeof element !== 'object') return undefined
      if (predicate(element)) return element
      return [element.props?.children].flat(Infinity).map(child => find(child, predicate)).find(Boolean)
    }
    const button = (tree, label) => find(tree, element => element.type === 'button' && (element.props['aria-label'] === label || element.props.children === label))
    let tree = PoolShellSettings()
    button(tree, 'Circular').props.onClick()
    if (draft.shape !== 'circle' || editor.tool !== null || scene.nodes[pool.id].shape !== 'rectangle') throw new Error('Draft shape choice started placement or changed an unselected pool')
    tree = PoolShellSettings()
    button(tree, 'Place pool').props.onClick()
    if (editor.tool !== 'pool:pool' || editor.mode !== 'build') throw new Error('Place pool did not arm placement')
    editor.tool = null; editor.mode = 'select'; selectedIds = [pool.id]
    tree = PoolShellSettings()
    if (button(tree, 'Place pool')) throw new Error('Editing state offers placement')
    button(tree, 'Circular').props.onClick()
    if (scene.nodes[pool.id].shape !== 'circle' || editor.tool !== null) throw new Error('Editing shape started another pool')
    if (scene.nodes[pool.id].polygon.length <= 4) throw new Error('Editing shape did not update pool geometry')
  `
  const process = Bun.spawn([Bun.which('bun')!, '-e', script], { stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stderr] = await Promise.all([process.exited, new Response(process.stderr).text()])
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
