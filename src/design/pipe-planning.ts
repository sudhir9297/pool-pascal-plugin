import type { PipeSegmentNode } from '@pascal-app/core'
import type { Box3 } from 'three'
import {
  isInsertableEquipment as insertionIsInsertableEquipment,
  planEquipmentInsertion as insertionPlanEquipmentInsertion,
  planEquipmentInsertionAsync as insertionPlanEquipmentInsertionAsync,
  type EquipmentInsertionPlan,
  type FittingPorts,
  type InsertableEquipment,
} from './equipment-insertion'
import { type RouteObstacle, routePipe, type RoutePoint } from './pipe-route'

/** The small interface the editor needs to ask the design layer for a plan. */
export type EquipmentPipePlanningRequest = {
  run: PipeSegmentNode
  index: number
  point: RoutePoint
  template: InsertableEquipment
  localBounds: Box3
  fittingPorts: FittingPorts
  obstacles?: RouteObstacle[]
}

// Keep the route callback at the seam rather than exposing the insertion module's
// positional tuple to the editor. This also lets synchronous and worker-backed
// routing share the same planning implementation.
export type EquipmentPipeRoute = (
  args: Parameters<typeof routePipe>,
) => Promise<ReturnType<typeof routePipe>>

export type { EquipmentInsertionPlan, InsertableEquipment }

export const isInsertableEquipment = insertionIsInsertableEquipment
export function planEquipmentInsertion(
  request: EquipmentPipePlanningRequest,
): EquipmentInsertionPlan | null {
  return insertionPlanEquipmentInsertion(
    request.run,
    request.index,
    request.point,
    request.template,
    request.localBounds,
    request.fittingPorts,
    request.obstacles,
  )
}

export function planEquipmentInsertionAsync(
  request: EquipmentPipePlanningRequest,
  route: EquipmentPipeRoute,
): Promise<EquipmentInsertionPlan | null> {
  return insertionPlanEquipmentInsertionAsync([
    request.run,
    request.index,
    request.point,
    request.template,
    request.localBounds,
    request.fittingPorts,
    request.obstacles,
  ], route)
}
