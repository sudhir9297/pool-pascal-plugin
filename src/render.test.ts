import { describe, expect, test } from 'bun:test'
import { poolPlugin } from './index'
import { poolRenderPlugin } from './render'

// Definition fields only an editing host reads (Pascal's edit-contribution field
// list); none may appear on a render definition.
const EDIT_FIELDS = [
  'extensions',
  'facingIndicator',
  'drafting',
  'connectedMove',
  'parametrics',
  'placementNotice',
  'quickActions',
  'quickActionNodeScope',
  'tool',
  'affordanceTools',
  'affordances',
  'toolHints',
  'affordanceHints',
  'toolOptions',
  'snapProfile',
  'snapDraftDirectional',
  'preview',
  'keyboardActions',
  'handles',
  'floorplanDependencies',
  'floorplanDependsOnSiblings',
  'floorplanAffectedIds',
  'floorplanSiblingOverrides',
  'floorplanAffordances',
  'floorplanMoveTarget',
] as const

type Definition = Record<string, unknown> & {
  kind: string
  schema: unknown
  schemaVersion: number
  defaults: () => unknown
  migrate?: Record<number, unknown>
  capabilities?: Record<string, unknown>
  renderer?: unknown
}

const rootNodes = (poolPlugin.nodes ?? []) as unknown as Definition[]
const renderNodes = (poolRenderPlugin.nodes ?? []) as unknown as Definition[]

describe('render-only pool plugin', () => {
  test('has the root plugin identity', () => {
    expect(poolRenderPlugin.id).toBe(poolPlugin.id)
    expect(poolRenderPlugin.apiVersion).toBe(poolPlugin.apiVersion)
  })

  test('registers the same kinds, schemas, versions, defaults and migrations', () => {
    expect(renderNodes.map((definition) => definition.kind)).toEqual(
      rootNodes.map((definition) => definition.kind),
    )
    renderNodes.forEach((render, index) => {
      const root = rootNodes[index]!
      expect(render.schema).toBe(root.schema)
      expect(render.schemaVersion).toBe(root.schemaVersion)
      expect(render.defaults()).toEqual(root.defaults() as never)
      expect(Object.keys(render.migrate ?? {})).toEqual(Object.keys(root.migrate ?? {}))
      expect(render.renderer).toBeDefined()
    })
  })

  test('keeps every render-side field of the root definitions', () => {
    renderNodes.forEach((render, index) => {
      const root = rootNodes[index]!
      for (const [field, value] of Object.entries(render)) {
        if (field === 'renderer' || field === 'capabilities') continue
        expect({ kind: render.kind, field, value }).toEqual({ kind: render.kind, field, value: root[field] })
      }
      const { paint: _paint, ...rootCapabilities } = root.capabilities ?? {}
      expect(render.capabilities).toEqual(rootCapabilities)
    })
  })

  test('carries no editing contributions', () => {
    for (const definition of renderNodes) {
      const present = EDIT_FIELDS.filter((field) => field in definition)
      expect({ kind: definition.kind, present }).toEqual({ kind: definition.kind, present: [] })
      expect(definition.capabilities ?? {}).not.toHaveProperty('paint')
    }
  })

  test('the root definitions still carry their editing contributions', () => {
    for (const definition of rootNodes) {
      expect(definition.snapProfile).toBe('item')
      expect(definition.parametrics).toBeDefined()
      expect(definition.capabilities).toHaveProperty('paint')
    }
    const pool = rootNodes.find((definition) => definition.kind === 'pool:pool')!
    expect(pool.handles).toBeDefined()
    expect(pool.floorplanAffordances).toBeDefined()
    expect(pool.renderer).not.toBe(renderNodes[0]!.renderer)
    const valve = rootNodes.find((definition) => definition.kind === 'pool:valve')!
    expect(valve.keyboardActions).toBeDefined()
  })
})
