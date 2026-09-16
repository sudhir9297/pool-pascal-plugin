export {
  countPools,
  getPoolGeometrySignature,
  getPoolResizePreviewTransform,
  getPoolWaterResolution,
  selectPoolRenderNodes,
} from './pool-render-plan'

/** Nested simulation render targets are not safe while the host owns an XR framebuffer. */
export function shouldAdvancePoolWater(
  immersiveXR: boolean,
  isWebGPURenderer: boolean,
  isDragging = false,
) {
  return !immersiveXR && isWebGPURenderer && !isDragging
}
