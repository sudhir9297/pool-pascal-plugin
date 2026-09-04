import type { Group, Object3D } from 'three'

/**
 * Gizmos must be siblings of a selected scene node. The editor outline pass
 * recursively includes every descendant mesh, even color-write-free hit
 * volumes, so mounting controls inside the PVC network leaks their silhouettes
 * into the network outline.
 */
export function pipeGizmoPortalTarget(networkRoot: Object3D): Object3D {
  return networkRoot.parent ?? networkRoot
}

/** Mirror the selected network's local transform on its sibling gizmo frame. */
export function syncPipeGizmoFrame(frame: Group, networkRoot: Object3D | null): boolean {
  // Updating a scene node can detach its preview root one frame before React
  // removes the portaled controls.
  if (!networkRoot) return false
  frame.position.copy(networkRoot.position)
  frame.quaternion.copy(networkRoot.quaternion)
  frame.scale.copy(networkRoot.scale)
  return true
}
