import { HOT_TUB_ART } from './art'
import type { HotTubPreset } from './hotTub-schema'

/** Per-hotTub colours, default height (metres), and a card `thumbnail` (a
 * replaceable placeholder image — see `thumbnails.ts`). Pure data shared by the
 * geometry builder and the panel. */
export type HotTubPresetSpec = {
  id: HotTubPreset
  label: string
  waterColor: string
  accentColor: string
  tileColor: string
  defaultHeight: number
  swatch: string
  thumbnail: string
}

export const HOT_TUB_PRESETS: Record<HotTubPreset, HotTubPresetSpec> = {
  spa: {
    id: 'spa',
    label: 'Spa',
    waterColor: '#fcfcf2',
    accentColor: '#f4c430',
    tileColor: '#4f7942',
    defaultHeight: 0.5,
    swatch: '#f4c430',
    thumbnail: HOT_TUB_ART.spa,
  },
  therapy: {
    id: 'therapy',
    label: 'Therapy Pool',
    waterColor: '#e0457b',
    accentColor: '#c43160',
    tileColor: '#3f7a3a',
    defaultHeight: 0.45,
    swatch: '#e0457b',
    thumbnail: HOT_TUB_ART.therapy,
  },
  plunge: {
    id: 'plunge',
    label: 'Plunge Spa',
    waterColor: '#9b6fd4',
    accentColor: '#7d52b8',
    tileColor: '#5a7a4a',
    defaultHeight: 0.6,
    swatch: '#9b6fd4',
    thumbnail: HOT_TUB_ART.plunge,
  },
}

export const HOT_TUB_PRESET_LIST: HotTubPresetSpec[] = Object.values(HOT_TUB_PRESETS)

/** Bounded seed pool so hotTubs share instancing variants (see pools). */
export const HOT_TUB_SEED_POOL = [1, 7, 13, 21, 34, 55]
