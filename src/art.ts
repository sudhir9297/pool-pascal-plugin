import courtyard from './assets/courtyard.webp'
import family from './assets/family.webp'
import fountain from './assets/fountain.webp'
import infinity from './assets/infinity.webp'
import lap from './assets/lap.webp'
import poolIcon from './assets/pool-icon.webp'
import plunge from './assets/plunge-pool.webp'
import cascade from './assets/cascade.webp'
import spa from './assets/spa.webp'
import therapy from './assets/therapy.webp'
import spillway from './assets/spillway.webp'
import plungeSpa from './assets/plunge.webp'
import type { HotTubPreset } from './hotTub-schema'
import type { WaterFeaturesPreset } from './waterFeatures-schema'
import type { PoolPreset } from './schema'

/**
 * Bundled preset artwork. The webp live in `./assets` and travel with the
 * package — no CDN, no per-app `public/` mirroring. Both consumers are Next, so
 * `transpilePackages` runs these imports through the image pipeline and `.src`
 * is the hashed, cached URL. The panel renders each as an `<img src>`.
 */
const url = (asset: { src: string }): string => asset.src

export const POOL_ART: Record<PoolPreset, string> = {
  lap: url(lap),
  family: url(family),
  infinity: url(infinity),
  plunge: url(plunge),
  courtyard: url(courtyard),
  spa: url(spa),
}

export const HOT_TUB_ART: Record<HotTubPreset, string> = {
  spa: url(spa),
  therapy: url(therapy),
  plunge: url(plungeSpa),
}

export const WATER_FEATURE_ART: Record<WaterFeaturesPreset, string> = {
  fountain: url(fountain),
  spillway: url(spillway),
  cascade: url(cascade),
}

/** The Pool panel / section icon. */
export const POOL_ICON = url(poolIcon)
