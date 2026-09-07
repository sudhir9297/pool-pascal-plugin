export type PoolSpilloverPlacementStage = 'first-pool' | 'second-pool'

type ToolHintVisibility = {
  subscribe: (onChange: () => void) => () => void
  value: () => boolean
}

let stage: PoolSpilloverPlacementStage = 'first-pool'
const listeners = new Set<() => void>()

export function subscribePoolSpilloverPlacementStage(onChange: () => void) {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

export function getPoolSpilloverPlacementStage() {
  return stage
}

export function setPoolSpilloverPlacementStage(next: PoolSpilloverPlacementStage) {
  if (stage === next) return
  stage = next
  for (const listener of listeners) listener()
}

function visibility(expected: PoolSpilloverPlacementStage): ToolHintVisibility {
  return {
    subscribe: (onChange) => {
      return subscribePoolSpilloverPlacementStage(onChange)
    },
    value: () => stage === expected,
  }
}

export const firstPoolHintVisibility = visibility('first-pool')
export const secondPoolHintVisibility = visibility('second-pool')
