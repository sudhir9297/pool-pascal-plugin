import { expect, test } from 'bun:test'

test('opening the pool picker arms the highlighted shape without resetting its settings', async () => {
  // Isolate hook mocks so other tests retain real React and editor stores.
  const panelPath = import.meta.resolve('./panel')
  const storePath = import.meta.resolve('./store')
  const stairStorePath = import.meta.resolve('../stair/editor/store')
  const sceneNodesPath = import.meta.resolve('./scene-nodes')
  const process = Bun.spawn([Bun.which('bun')!, '-e', `
    import { mock } from 'bun:test'
    import * as React from 'react'
    const actualReact = { ...React }
    let menu = 'root'
    let tool = null
    let mode = 'select'
    const settings = { shape: 'rectangle', length: 12, width: 6 }
    const editor = { setTool(value) { tool = value }, setMode(value) { mode = value } }
    mock.module('react', () => ({ ...actualReact, useEffect() {}, useState() { return [menu, value => { menu = value }] } }))
    mock.module('zustand/react/shallow', () => ({ useShallow: selector => selector }))
    mock.module(${JSON.stringify(sceneNodesPath)}, () => ({ countPoolPluginNodes: () => ({}) }))
    mock.module('@pascal-app/core', () => ({ useScene: selector => selector({ nodes: {} }) }))
    mock.module('@pascal-app/editor', () => ({
      useEditor: { getState: () => editor },
      SegmentedControl() {}, SliderControl() {}, ToggleControl() {},
    }))
    mock.module(${JSON.stringify(storePath)}, () => ({ usePoolStore: Object.assign(selector => selector(settings), { getState: () => settings }) }))
    mock.module(${JSON.stringify(stairStorePath)}, () => ({ usePoolStairStore: selector => selector({ variant: 'classic' }) }))
    const { default: Panel } = await import(${JSON.stringify(panelPath)})
    function find(element, predicate) {
      if (!element || typeof element !== 'object') return
      if (predicate(element)) return element
      for (const child of [element.props?.children].flat(Infinity)) {
        const match = find(child, predicate)
        if (match) return match
      }
    }
    for (const shape of ['rectangle', 'circle']) {
      settings.shape = shape
      menu = 'root'; tool = null; mode = 'select'
      find(Panel(), element => element.props?.label === 'Swimming pool').props.onClick()
      if (menu !== 'pool-types' || tool !== 'pool:pool' || mode !== 'build') {
        throw new Error('Picker opened but placement is not armed: ' + JSON.stringify({ menu, tool, mode }))
      }
      const picker = find(Panel(), element => element.props?.selected === shape)
      if (!picker || settings.length !== 12 || settings.width !== 6) throw new Error('Selected preset or dimensions were reset')
    }
  `], { stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stderr] = await Promise.all([process.exited, new Response(process.stderr).text()])
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
