import { Matrix4, Quaternion, Vector3 } from 'three'

export type PipeRotationFrame = {
  radial: Vector3
  tangent: Vector3
  normal: Vector3
  quaternion: Quaternion
}

/**
 * Build the same fully-determined basis used by a pivot rotator: local X is
 * the branch's starting radial direction, local Y is the positive angular
 * direction, and local Z is the rotation axis.
 */
export function createPipeRotationFrame(axis: Vector3, branchDirection: Vector3): PipeRotationFrame {
  const normal = axis.clone()
  if (normal.lengthSq() <= Number.EPSILON) normal.set(0, 1, 0)
  normal.normalize()

  const radial = branchDirection.clone().addScaledVector(normal, -branchDirection.dot(normal))
  if (radial.lengthSq() <= 1e-8) {
    const fallback = Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0)
    radial.crossVectors(fallback, normal)
  }
  radial.normalize()
  const tangent = new Vector3().crossVectors(normal, radial).normalize()
  const quaternion = new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(radial, tangent, normal),
  )

  return { radial, tangent, normal, quaternion }
}

/** Angular cursor delta in a stable pivot frame, normalized across ±π. */
export function pipeRotationDelta(
  origin: Vector3,
  radial: Vector3,
  tangent: Vector3,
  start: Vector3,
  current: Vector3,
): number {
  const startOffset = start.clone().sub(origin)
  const currentOffset = current.clone().sub(origin)
  const startAngle = Math.atan2(startOffset.dot(tangent), startOffset.dot(radial))
  const currentAngle = Math.atan2(currentOffset.dot(tangent), currentOffset.dot(radial))
  return Math.atan2(Math.sin(currentAngle - startAngle), Math.cos(currentAngle - startAngle))
}
