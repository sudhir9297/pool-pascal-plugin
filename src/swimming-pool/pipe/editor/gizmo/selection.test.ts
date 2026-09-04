import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { shouldClearLocalPipeSelectionForGlobalSelection, shouldClearPipeSelection } from './selection'

describe('shouldClearPipeSelection', () => {
  test('clears a locally selected fitting when global node selection is empty', () => {
    expect(shouldClearPipeSelection({
      editorMode: 'select',
      nodeSelected: false,
      edgeSelected: false,
      fittingSelected: true,
      nodeClickHandled: false,
      pipeClickHandled: false,
    })).toBe(true)
  })

  test('does not clear on the pipe part click that established selection', () => {
    expect(shouldClearPipeSelection({
      editorMode: 'select',
      nodeSelected: false,
      edgeSelected: true,
      fittingSelected: false,
      nodeClickHandled: false,
      pipeClickHandled: true,
    })).toBe(false)
  })

  test('does not clear while a non-select tool owns the canvas', () => {
    expect(shouldClearPipeSelection({
      editorMode: 'build',
      nodeSelected: false,
      edgeSelected: false,
      fittingSelected: true,
      nodeClickHandled: false,
      pipeClickHandled: false,
    })).toBe(false)
  })
})

describe('shouldClearLocalPipeSelectionForGlobalSelection', () => {
  test('preserves a local pipe-part selection while global selection is empty', () => {
    expect(shouldClearLocalPipeSelectionForGlobalSelection({
      selectedCount: 0,
    })).toBe(false)
  })

  test('clears a local pipe-part selection when another scene node is selected', () => {
    expect(shouldClearLocalPipeSelectionForGlobalSelection({
      selectedCount: 1,
    })).toBe(true)
  })

  test('clears local selection when this pipe becomes globally selected', () => {
    expect(shouldClearLocalPipeSelectionForGlobalSelection({
      selectedCount: 1,
    })).toBe(true)
  })
})

describe('PVC global selection ownership', () => {
  test('does not collapse an editor marquee containing multiple pipe networks', () => {
    const previewSource = readFileSync(new URL('../preview.tsx', import.meta.url), 'utf8')

    expect(previewSource).not.toMatch(
      /selectedIds\.length\s*<=\s*1[\s\S]{0,300}setSelection\(\{\s*selectedIds:\s*\[node\.id\]/,
    )
  })

  test('does not clear the editor selection from the PVC canvas-click cleanup', () => {
    const previewSource = readFileSync(new URL('../preview.tsx', import.meta.url), 'utf8')
    const canvasCleanup = previewSource.match(
      /const clearPipeSelection = \(\) => \{[\s\S]*?\n    \}/,
    )?.[0]

    expect(canvasCleanup).toBeDefined()
    expect(canvasCleanup).not.toContain('setSelection({ selectedIds: [] })')
  })
})
