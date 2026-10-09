import { expect, test } from 'bun:test'

// Exercise the real panel and Zustand shallow selectors; isolate host hook mocks.
test('Review snapshots stay stable for repeated reads and update after fitting changes', async () => {
  const panelPath = import.meta.resolve('./review-panel')
  const schemaPath = import.meta.resolve('../core/schema')
  const attachmentsPath = import.meta.resolve('../design/default-pool-attachments')
  const script = `
    import { mock } from 'bun:test'
    import * as React from 'react'
    import * as Core from '@pascal-app/core'
    import { PoolNode } from ${JSON.stringify(schemaPath)}
    import { createDefaultPoolAttachments } from ${JSON.stringify(attachmentsPath)}
    const pool = PoolNode.parse({})
    const attachments = createDefaultPoolAttachments(pool)
    let state = { nodes: Object.fromEntries([pool, ...attachments].map(node => [node.id, node])) }
    let selectedIds = [pool.id]
    React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = {
      useRef: value => ({ current: value }), useMemo: callback => callback(),
    }
    mock.module('@pascal-app/core', () => ({ ...Core, useScene: selector => {
      const first = selector(state), second = selector(state)
      if (!Object.is(first, second)) throw new Error('Review getSnapshot is unstable: identical scene reads trigger a render loop')
      return second
    } }))
    mock.module('@pascal-app/viewer', () => ({ useViewer: selector => selector({ selection: { selectedIds } }) }))
    const { PoolReviewPanel } = await import(${JSON.stringify(panelPath)})
    const render = () => PoolReviewPanel({ onOpenShell() {}, onOpenSystems() {} })
    function text(element) {
      if (typeof element === 'string' || typeof element === 'number') return String(element)
      if (!element || typeof element !== 'object') return ''
      if (typeof element.type === 'function') return text(element.type(element.props))
      return [element.props?.children].flat(Infinity).map(text).join(' ')
    }
    if (!text(render()).includes('Readiness')) throw new Error('Review did not render')
    const inlet = attachments.find(node => node.type === 'pool:inlet')
    state = { nodes: Object.fromEntries(Object.entries(state.nodes).filter(([id]) => id !== inlet.id)) }
    if (!text(render()).includes('3 placed')) throw new Error('Review counts did not update after fitting removal')
    selectedIds = []
    if (!text(render()).includes('Place or select one pool')) throw new Error('Unselected pool was implicitly reviewed')
    state = { nodes: {} }
    if (!text(render()).includes('Place or select one pool')) throw new Error('Empty review did not render')
  `
  const process = Bun.spawn([Bun.which('bun')!, '-e', script], {
    cwd: import.meta.dir, stdout: 'pipe', stderr: 'pipe',
  })
  const [exitCode, stderr] = await Promise.all([process.exited, new Response(process.stderr).text()])
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
