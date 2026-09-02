export const POOL_ENTRY_FEATURES = ['none', 'steps', 'tanning-shelf', 'beach-entry'] as const
export type PoolEntryFeature = (typeof POOL_ENTRY_FEATURES)[number]
export const POOL_ENTRY_FEATURE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'steps', label: 'Steps' },
  { value: 'tanning-shelf', label: 'Tanning shelf' },
  { value: 'beach-entry', label: 'Beach entry' },
] as const satisfies ReadonlyArray<{ value: PoolEntryFeature; label: string }>
