import type { PoolFilterData } from './types'

/**
 * Canonical pool filter catalog.
 *
 * Keep this list data-only so it can later be consumed by the filter node,
 * editor palette, and equipment sizing helpers without duplicating specs.
 */
export const POOL_FILTER_CATALOG: readonly PoolFilterData[] = []

export type PoolFilterId = PoolFilterData['id']

export function getPoolFilterData(id: string): PoolFilterData | undefined {
  return POOL_FILTER_CATALOG.find((filter) => filter.id === id)
}
