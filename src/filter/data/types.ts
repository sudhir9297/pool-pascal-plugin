/** Filter technologies supported by the pool filter catalog. */
export type PoolFilterTechnology = 'cartridge' | 'sand' | 'diatomaceous-earth'

/** Shared specification shape for a pool filter catalog entry. */
export type PoolFilterData = {
  /** Stable identifier used when referring to this filter model. */
  id: string
  /** Human-readable model name. */
  name: string
  technology: PoolFilterTechnology
  /** Filter body dimensions in metres. */
  dimensions: {
    width: number
    height: number
    depth: number
  }
  /** Dimensions that drive the procedural tank, excluding the valve and base. */
  tank: {
    diameter: number
    bodyHeight: number
  }
  /** Nominal socket diameter in metres. */
  connectionDiameter: number
  /** Nominal circulation capacity in cubic metres per hour. */
  flowRate: {
    min: number
    max: number
  }
  /** Filter area in square metres, when supplied by the manufacturer. */
  filtrationArea?: number
  /** Manufacturer and catalog-specific values that do not drive geometry. */
  metadata?: Record<string, string | number | boolean>
}
