export type PipeGizmoAxis = 'x' | 'y' | 'z'
export type PipeGizmoPlane = 'xy' | 'xz' | 'yz'
export type PipeGizmoOperation = 'translate' | 'rotate'
export type PipeGizmoConstraint = PipeGizmoAxis | PipeGizmoPlane | 'free'

export type PipeActiveGizmoTransform = {
  operation: PipeGizmoOperation
  constraint: PipeGizmoConstraint
}

export type PipeGizmoVisualState = 'normal' | 'active' | 'faded'
