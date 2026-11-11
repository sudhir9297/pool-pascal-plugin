import type { AnyNodeDefinition, NodeDefinition } from '@pascal-app/core'

type NodeSchema = AnyNodeDefinition['schema']

/**
 * Editing contributions in the node-definition contract, the same list Pascal's
 * built-in nodes split on. A read-only viewer registers none of them.
 */
type EditField =
  | 'extensions'
  | 'facingIndicator'
  | 'drafting'
  | 'connectedMove'
  | 'parametrics'
  | 'placementNotice'
  | 'quickActions'
  | 'quickActionNodeScope'
  | 'tool'
  | 'affordanceTools'
  | 'affordances'
  | 'toolHints'
  | 'affordanceHints'
  | 'toolOptions'
  | 'snapProfile'
  | 'snapDraftDirectional'
  | 'preview'
  | 'keyboardActions'
  | 'handles'
  | 'floorplanDependencies'
  | 'floorplanDependsOnSiblings'
  | 'floorplanAffectedIds'
  | 'floorplanSiblingOverrides'
  | 'floorplanAffordances'
  | 'floorplanMoveTarget'

/**
 * A kind's render half (`definition.render.ts`): schema, version, defaults,
 * capabilities, renderer, system, ports, read-only floor plan, export animation
 * and presentation. `./render` registers these alone; it never imports
 * `@pascal-app/editor`.
 */
export type PoolRenderDefinition<S extends NodeSchema> = Omit<NodeDefinition<S>, EditField>

/**
 * A kind's edit half (`definition.edit.ts`): placement tools and previews,
 * handles, parameters, keyboard actions and plan editing. `renderer` is allowed
 * only for an editor renderer that wraps the read-only one.
 */
export type PoolEditContribution<S extends NodeSchema> = {
  [K in EditField & keyof NodeDefinition<S>]?: NodeDefinition<S>[K]
} & Pick<Partial<NodeDefinition<S>>, 'renderer'>

/**
 * The full definition editing hosts load: the render half plus the edit half.
 * Top-level fields of the edit half replace the render half's.
 */
export function composeDefinition<S extends NodeSchema>(
  render: PoolRenderDefinition<S>,
  edit: PoolEditContribution<S>,
): NodeDefinition<S> {
  return { ...render, ...edit } as NodeDefinition<S>
}
