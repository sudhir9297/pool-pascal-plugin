import type { PoolFilterData } from './types'

/**
 * Canonical pool filter catalog.
 *
 * Keep this list data-only so it can later be consumed by the filter node,
 * editor palette, and equipment sizing helpers without duplicating specs.
 */
export const POOL_FILTER_CATALOG: readonly PoolFilterData[] = [
  {
    id: 'cartridge-standard-500',
    name: 'Standard cartridge filter',
    technology: 'cartridge',
    dimensions: { width: 0.55, height: 0.85, depth: 0.55 },
    tank: { diameter: 0.5, bodyHeight: 0.61 },
    connectionDiameter: 0.05,
    flowRate: { min: 6, max: 14 },
    filtrationArea: 46,
    metadata: { cleaning: 'Remove and hose cartridge' },
  },
  {
    id: 'sand-standard-600',
    name: 'Compact top-mount sand filter',
    technology: 'sand',
    dimensions: { width: 0.8, height: 1.02, depth: 0.75 },
    tank: { diameter: 0.68, bodyHeight: 0.66 },
    connectionDiameter: 0.05,
    flowRate: { min: 8, max: 18 },
    filtrationArea: 0.28,
    metadata: { cleaning: 'Backwash and rinse', valve: 'Top-mount multiport' },
  },
  {
    id: 'de-standard-600',
    name: 'Standard diatomaceous-earth filter',
    technology: 'diatomaceous-earth',
    dimensions: { width: 0.65, height: 0.95, depth: 0.65 },
    tank: { diameter: 0.6, bodyHeight: 0.67 },
    connectionDiameter: 0.05,
    flowRate: { min: 8, max: 16 },
    filtrationArea: 5.6,
    metadata: { cleaning: 'Backwash and recharge DE' },
  },
]

export type PoolFilterId = PoolFilterData['id']

export function getPoolFilterData(id: string): PoolFilterData | undefined {
  return POOL_FILTER_CATALOG.find((filter) => filter.id === id)
}
