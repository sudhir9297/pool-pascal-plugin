export type PipeGizmoDimensions = {
  length: number
  radius: number
  rotationRadius: number
  planeHandleSize: number
  planeHandleOffset: number
}

// Kept equivalent to the block editor's transform gizmo. Scaling is
// intentionally omitted from the PVC version.
const PIPE_GIZMO_DIMENSIONS: PipeGizmoDimensions = {
  length: 0.7,
  radius: 0.022,
  rotationRadius: 0.455,
  planeHandleSize: 0.14,
  planeHandleOffset: 0.175,
}

export function pipeGizmoDimensions(): PipeGizmoDimensions {
  return PIPE_GIZMO_DIMENSIONS
}

export type PipeGizmoHitDimensions = {
  axisRadius: number
  planeSize: number
  rotationTube: number
  rotationArc: number
  rotationStart: number
}

export function pipeGizmoHitDimensions(
  radius = PIPE_GIZMO_DIMENSIONS.radius,
  planeHandleSize = PIPE_GIZMO_DIMENSIONS.planeHandleSize,
): PipeGizmoHitDimensions {
  const rotationStart = Math.PI / 15
  return {
    axisRadius: radius * 3,
    planeSize: planeHandleSize * 1.1,
    rotationTube: radius * 1.5,
    rotationArc: Math.PI / 2 - rotationStart * 2,
    rotationStart,
  }
}
