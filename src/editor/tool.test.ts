import { expect, test } from 'bun:test'

test('pool tool owns freehand strokes and gives one placement sound with grid snap feedback', async () => {
  const toolPath = import.meta.resolve('./tool')
  const storePath = import.meta.resolve('./store')
  const nodesPath = import.meta.resolve('./scene-nodes')
  const script = `
    import { mock } from 'bun:test'
    import * as React from 'react'
    import * as Core from '@pascal-app/core'
    import { Group } from 'three'
    import { DEFAULT_POOL } from ${JSON.stringify(import.meta.resolve('../core/schema'))}
    const frames = new Map()
    let frameId = 0
    globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId }
    globalThis.cancelAnimationFrame = id => frames.delete(id)
    const tick = () => { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()) }
    const handlers = new Map()
    const emitter = {
      on: (name, handler) => handlers.set(name, handler),
      off: name => handlers.delete(name),
      emit: (name, event) => handlers.get(name)?.(event),
    }
    let refIndex = 0, created = [], cleanups = [], mode = 'build', gridSnap = false, sounds = [], magneticSnap = {}
    const settings = { ...DEFAULT_POOL, shape: 'spline' }
    const scene = { nodes: {}, readOnly: false }
    const editor = { gridSnapStep: 1, setDraftVertexCount() {}, setTool() {}, setMode: next => mode = next }
    mock.module('react', () => ({ ...React,
      useRef: value => ({ current: refIndex++ === 0 ? new Group() : value }),
      useMemo: fn => fn(), useState: value => [value, () => {}],
      useEffect: fn => { const cleanup = fn(); if (cleanup) cleanups.push(cleanup) },
    }))
    mock.module('@pascal-app/core', () => ({ ...Core, emitter,
      useScene: Object.assign(selector => selector(scene), { getState: () => scene }),
    }))
    mock.module('@pascal-app/viewer', () => ({ useViewer: selector => selector({
      selection: { levelId: 'level_test' }, setSelection() {},
    }) }))
    mock.module('@react-three/fiber', () => ({ useThree: selector => selector({ camera: {} }) }))
    mock.module(${JSON.stringify(storePath)}, () => ({ usePoolStore: Object.assign(selector => selector(settings), { getState: () => settings }) }))
    mock.module(${JSON.stringify(nodesPath)}, () => ({
      nextSwimmingPoolName: () => 'Test Pool', getPoolNodes: () => [],
      createPoolPluginNode: node => created.push(node),
    }))
    mock.module('@pascal-app/editor', () => ({
      CursorSphere() {}, EDITOR_LAYER: 0, clearPlacementSurface() {}, clearSlabSnapFeedback() {},
      isAngleSnapActive: () => false, isGridSnapActive: () => gridSnap,
      markToolCancelConsumed() {}, publishHorizontalConstructionPlane() {}, publishPlacementSurface() {},
      resolvePointerSupportSurface: () => null,
      resolveEventConstructionPlane: () => ({ elevation: 0, localY: 0 }),
      resampleTerrainConstructionPlane: plane => plane,
      resolveSlabPlanPointSnap: args => ({ point: args.fallbackPoint, ...magneticSnap }), triggerSFX: sound => sounds.push(sound),
      useEditor: Object.assign(selector => selector(editor), { getState: () => editor }),
      useFloorplanDraftPreview: { getState: () => ({ setPolygonDraft() {}, setCursorPoint() {} }) },
    }))
    class Element { closest() { return this.svg ?? null } }
    class Canvas extends Element {}
    class Svg extends Element {
      constructor() { super(); this.svg = this }
      querySelector() { return { getScreenCTM: () => ({ inverse: () => ({}) }) } }
    }
    class DOMPoint {
      constructor(x, y) { this.x = x; this.y = y }
      matrixTransform() { return { x: this.x / 10, y: this.y / 10 } }
    }
    Object.assign(globalThis, { Element, HTMLCanvasElement: Canvas, SVGSVGElement: Svg, DOMPoint,
      document: new EventTarget(), window: new EventTarget() })
    const { default: Tool } = await import(${JSON.stringify(toolPath)})
    function pointer(type, surface, id = 1) {
      const event = new Event(type, { cancelable: true })
      Object.defineProperty(event, 'target', { value: surface })
      Object.assign(event, { button: 0, pointerId: id, clientX: 0, clientY: 0 })
      document.dispatchEvent(event)
    }
    function move(x, z, target) { emitter.emit('grid:move', { position: [x, 0, z], nativeEvent: { target } }) }
    for (const surface of [new Svg(), new Canvas()]) {
      refIndex = 0; created = []; cleanups = []; mode = 'build'; Tool()
      move(0, 0, surface); pointer('pointerdown', surface)
      move(3, 0, surface); move(3, 3, surface)
      pointer('pointerup', surface, 2)
      if (created.length) throw new Error('Other pointer committed the stroke')
      move(0, 3, surface); pointer('pointerup', surface)
      if (created.length !== 1 || created[0].shape !== 'spline' || mode !== 'select') throw new Error('Stroke did not commit')
      cleanups.forEach(fn => fn())

      refIndex = 0; created = []; cleanups = []; mode = 'build'; Tool()
      move(0, 0, surface); pointer('pointerdown', surface)
      move(3, 0, surface); move(3, 3, surface); pointer('pointercancel', surface)
      pointer('pointerup', surface)
      if (created.length) throw new Error('Cancelled stroke committed')
      cleanups.forEach(fn => fn())

      refIndex = 0; created = []; cleanups = []; mode = 'build'; Tool()
      move(0, 0, surface); pointer('pointerdown', surface)
      move(3, 0, surface); move(3, 3, surface); move(0, 3, surface); move(0, 0, surface); tick()
      if (created.length !== 1 || mode !== 'build') throw new Error('Closure was not committed before release')
      pointer('pointerup', surface)
      if (created.length !== 1 || mode !== 'select') throw new Error('Closure release was not consumed')
      cleanups.forEach(fn => fn())
    }
    settings.shape = 'rectangle'; gridSnap = true
    refIndex = 0; created = []; cleanups = []; sounds = []; mode = 'build'; Tool()
    const surface = new Canvas()
    move(0, 0, surface); tick()
    move(1.1, 0, surface); tick()
    if (sounds.filter(sound => sound === 'sfx:grid-snap').length !== 1) throw new Error('Preset did not give grid snap feedback')
    move(1.2, 0, surface); tick()
    if (sounds.length !== 1) throw new Error('Movement within a grid cell repeated snap feedback')
    emitter.emit('grid:click', { position: [1.2, 0, 0], nativeEvent: { target: surface } })
    emitter.emit('grid:click', { position: [1.2, 0, 0], nativeEvent: { target: surface } })
    if (created.length !== 1 || mode !== 'select') throw new Error('Preset placement did not finish')
    if (sounds.filter(sound => sound.startsWith('sfx:structure-build')).length !== 1) throw new Error('Preset placement played duplicate building sounds')
    cleanups.forEach(fn => fn())
    gridSnap = false; refIndex = 0; cleanups = []; sounds = []; Tool()
    move(0, 0, surface); tick(); move(0.1, 0, surface); tick()
    if (sounds.length) throw new Error('Unsnapped motion played snap feedback')
    magneticSnap = { wallSnap: 'wall', wallIds: ['wall_test'], guides: [] }
    move(0.2, 0, surface); tick()
    if (sounds.length !== 1) throw new Error('Magnetic snap did not play feedback with grid disabled')
    move(0.3, 0, surface); tick()
    if (sounds.length !== 1) throw new Error('Moving along a snapped wall repeated snap feedback')
    magneticSnap = {}; move(0.4, 0, surface); tick()
    magneticSnap = { guides: [{ axis: 'x', coord: 1, candidateNodeId: 'pool_other', distance: 1 }] }
    move(1, 0, surface); tick()
    if (sounds.length !== 2) throw new Error('Alignment snap did not play feedback')
    magneticSnap.guides[0].distance = 2
    move(1, 0.1, surface); tick()
    if (sounds.length !== 2) throw new Error('Changing alignment guide length repeated snap feedback')
    cleanups.forEach(fn => fn())
  `
  const process = Bun.spawn([Bun.which('bun')!, '-e', script], { stdout: 'pipe', stderr: 'pipe' })
  const [exitCode, stderr] = await Promise.all([process.exited, new Response(process.stderr).text()])
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
