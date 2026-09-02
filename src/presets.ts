import { POOL_ART } from './art'
import type { PoolPreset, PoolSize } from './schema'

/**
 * Per-design config: the procedural preset name for each size, a default placement
 * height per size (metres), a swatch colour, and a card `thumbnail` (a
 * replaceable placeholder image — see `thumbnails.ts`). Pure data — no three.js,
 * no React — shared by the panel grid and the instanced renderer so they stay in
 * lockstep. `ez[size]` is the exact geometry preset name passed to
 * `pool.loadPreset(...)`, exposing the bundled geometry presets through a
 * clean design × size model. `spa` has a single preset (size ignored).
 */
export type PoolPresetSpec = {
  id: PoolPreset
  label: string
  /** Procedural geometry preset keyed by size. */
  ez: Record<PoolSize, string>
  /** Default placement height keyed by size. */
  height: Record<PoolSize, number>
  /** Whether the size control applies (false for `spa`). */
  sized: boolean
  swatch: string
  thumbnail: string
}

function ezSizes(family: string): Record<PoolSize, string> {
  return { small: `${family} Small`, medium: `${family} Medium`, large: `${family} Large` }
}

export const POOL_PRESETS: Record<PoolPreset, PoolPresetSpec> = {
  lap: {
    id: 'lap',
    label: 'Lap Pool',
    ez: ezSizes('Oak'),
    height: { small: 5, medium: 7, large: 11 },
    sized: true,
    swatch: '#4f7942',
    thumbnail: POOL_ART.lap,
  },
  family: {
    id: 'family',
    label: 'Family Pool',
    ez: ezSizes('Pine'),
    height: { small: 6, medium: 9, large: 14 },
    sized: true,
    swatch: '#2f5d3a',
    thumbnail: POOL_ART.family,
  },
  infinity: {
    id: 'infinity',
    label: 'Infinity Pool',
    ez: ezSizes('Aspen'),
    height: { small: 5, medium: 8, large: 12 },
    sized: true,
    swatch: '#8fae5d',
    thumbnail: POOL_ART.infinity,
  },
  plunge: {
    id: 'plunge',
    label: 'Plunge Pool',
    ez: ezSizes('Ash'),
    height: { small: 5, medium: 8, large: 12 },
    sized: true,
    swatch: '#6f9457',
    thumbnail: POOL_ART.plunge,
  },
  courtyard: {
    id: 'courtyard',
    label: 'Courtyard Pool',
    ez: { small: 'Bush 1', medium: 'Bush 2', large: 'Bush 3' },
    height: { small: 1.2, medium: 1.5, large: 1.8 },
    sized: true,
    swatch: '#5c8a4a',
    thumbnail: POOL_ART.courtyard,
  },
  spa: {
    id: 'spa',
    label: 'Spa Pool',
    ez: { small: 'Trellis', medium: 'Trellis', large: 'Trellis' },
    height: { small: 3, medium: 3, large: 3 },
    sized: false,
    swatch: '#8b6b45',
    thumbnail: POOL_ART.spa,
  },
}

export const POOL_PRESET_LIST: PoolPresetSpec[] = Object.values(POOL_PRESETS)

/** The procedural preset name for a design + size (size ignored for `spa`). */
export function ezPresetOf(preset: PoolPreset, size: PoolSize): string {
  return (POOL_PRESETS[preset] ?? POOL_PRESETS.family).ez[size]
}

/** Default placement height for a species + size. */
export function defaultHeightOf(preset: PoolPreset, size: PoolSize): number {
  return (POOL_PRESETS[preset] ?? POOL_PRESETS.family).height[size]
}

/**
 * Bounded seed pool. The placement tool and the Randomize action pick from
 * this set so pools share geometry variants — that sharing is what makes
 * instancing pay off. A power user can still type an arbitrary seed in the
 * inspector; that pool just renders as its own single-instance variant.
 */
export const POOL_SEED_POOL = [1, 7, 13, 21, 34, 55, 89, 144]

/** Pick a seed from the pool, varied by an index so it stays deterministic
 * (no Math.random in schema-importable code paths). */
export function seedFromPool(index: number): number {
  return POOL_SEED_POOL[Math.abs(index) % POOL_SEED_POOL.length] ?? 1
}
