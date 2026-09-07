import { POOL_FINISHES, type PoolFinish } from '../core/pool-options'
export { POOL_FINISHES, type PoolFinish } from '../core/pool-options'
type PoolFinishKind = 'solid' | 'speckle' | 'pebble' | 'polished' | 'glass' | 'mosaic'

export type PoolFinishSettings = {
  kind: PoolFinishKind
  base: string
  accent: string
  highlight: string
  grout: string
  scale: number
  contrast: number
  sparkle: number
}

const solid = (base: string): PoolFinishSettings => ({
  kind: 'solid', base, accent: base, highlight: base, grout: base,
  scale: 1, contrast: 0, sparkle: 0,
})

export const POOL_FINISH_SETTINGS: Record<PoolFinish, PoolFinishSettings> = {
  'clean-white-plaster': solid('#edf1eb'),
  'clean-pale-blue-plaster': solid('#c8e2e4'),
  'white-plaster': solid('#e8eeeb'),
  'quartz-white': {
    kind: 'speckle', base: '#dfe9e4', accent: '#9db5af', highlight: '#f8fbf5', grout: '#cbdad5',
    scale: 8, contrast: 0.28, sparkle: 0,
  },
  'quartz-blue-gray': {
    kind: 'speckle', base: '#8eb8bb', accent: '#527f88', highlight: '#c8e1dc', grout: '#789fa3',
    scale: 8, contrast: 0.3, sparkle: 0,
  },
  'natural-pebble-aqua': {
    kind: 'pebble', base: '#5d9ca1', accent: '#2f6872', highlight: '#9cc1b7', grout: '#4d858b',
    scale: 12, contrast: 0.62, sparkle: 0,
  },
  'natural-pebble-gray': {
    kind: 'pebble', base: '#8b9995', accent: '#4f625f', highlight: '#b7bfaf', grout: '#74827f',
    scale: 12, contrast: 0.58, sparkle: 0,
  },
  'polished-aggregate-blue': {
    kind: 'polished', base: '#5f9fa8', accent: '#2e6879', highlight: '#b6e2dc', grout: '#4e8790',
    scale: 10, contrast: 0.35, sparkle: 0.18,
  },
  'glass-bead-aqua': {
    kind: 'glass', base: '#4eabb7', accent: '#167487', highlight: '#d9ffff', grout: '#3c8d98',
    scale: 14, contrast: 0.38, sparkle: 0.72,
  },
  'light-mosaic': {
    kind: 'mosaic', base: '#c5d3d1', accent: '#1496b5', highlight: '#5dd4d8', grout: '#b8ccca',
    scale: 4, contrast: 1, sparkle: 0,
  },
  'blue-mosaic': {
    kind: 'mosaic', base: '#91c9cc', accent: '#087c9d', highlight: '#43c3ce', grout: '#82b9be',
    scale: 4.5, contrast: 1, sparkle: 0,
  },
  'dark-mosaic': {
    kind: 'mosaic', base: '#718f91', accent: '#07556f', highlight: '#2298a9', grout: '#648285',
    scale: 4, contrast: 1, sparkle: 0,
  },
}

export function getPoolFinishSettings(value: unknown) {
  return POOL_FINISH_SETTINGS[
    typeof value === 'string' && POOL_FINISHES.includes(value as PoolFinish)
      ? value as PoolFinish
      : 'light-mosaic'
  ]
}
