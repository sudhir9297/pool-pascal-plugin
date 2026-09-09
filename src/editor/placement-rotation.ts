export function isPlacementRotationKey(event: KeyboardEvent): boolean {
  const target = event.target
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]'))) return false
  return event.key.toLowerCase() === 'r' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.repeat
}

export function rotatePlanPoint([x, z]: [number, number], yaw: number): [number, number] {
  return [x * Math.cos(yaw) + z * Math.sin(yaw), -x * Math.sin(yaw) + z * Math.cos(yaw)]
}
