import { Color } from 'three'

// A restrained cool gray-beige pool-rock family. The small range keeps the
// coping cohesive while avoiding a repeated, perfectly uniform material.
export const POOL_ROCK_COLORS = [
  '#b8b6af',
  '#bebcb5',
  '#b0afa9',
  '#bbb9b2',
  '#b4b2ac',
] as const

export function getPoolRockColor(seed: number, index: number) {
  const value = Math.abs(Math.sin(seed * 0.000013 + index * 1.618))
  const base = new Color(POOL_ROCK_COLORS[Math.floor(value * POOL_ROCK_COLORS.length) % POOL_ROCK_COLORS.length])
  const hueShift = (Math.sin(seed * 0.000031 + index * 2.41) - 0.5) * 0.006
  const saturationShift = (Math.sin(seed * 0.000047 + index * 3.17) - 0.5) * 0.018
  const lightnessShift = (Math.sin(seed * 0.000067 + index * 4.23) - 0.5) * 0.035
  return base.offsetHSL(hueShift, saturationShift, lightnessShift)
}
