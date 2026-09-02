export const POOL_FINISHES = [
  'light-mosaic',
  'white-plaster',
  'blue-mosaic',
  'dark-mosaic',
] as const

export type PoolFinish = (typeof POOL_FINISHES)[number]

export type PoolFinishSettings = {
  base: string
  tile: [string, string]
  grout: string
  scale: number
}

export const POOL_FINISH_SETTINGS: Record<PoolFinish, PoolFinishSettings> = {
  'light-mosaic': { base: '#c5d3d1', tile: ['#1496b5', '#5dd4d8'], grout: '#b8ccca', scale: 4 },
  'white-plaster': { base: '#e8eeeb', tile: ['#d5e6e3', '#edf5f0'], grout: '#d9e5e1', scale: 2.5 },
  'blue-mosaic': { base: '#91c9cc', tile: ['#087c9d', '#43c3ce'], grout: '#82b9be', scale: 4.5 },
  'dark-mosaic': { base: '#718f91', tile: ['#07556f', '#2298a9'], grout: '#648285', scale: 4 },
}

export function getPoolFinishSettings(value: unknown) {
  return POOL_FINISH_SETTINGS[
    typeof value === 'string' && POOL_FINISHES.includes(value as PoolFinish)
      ? value as PoolFinish
      : 'light-mosaic'
  ]
}
