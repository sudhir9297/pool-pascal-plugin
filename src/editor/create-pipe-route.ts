import { findLevelAncestorId, nodeRegistry, PipeFittingNode, PipeSegmentNode, sceneRegistry, useScene, type AnyNode, type NodePort } from '@pascal-app/core'
import { Box3, Euler, Matrix4, Vector3 } from 'three'
import { planDwvConnection } from '../core/dwv-connection'
import { routePipe, type RouteObstacle, type RoutePoint } from '../design/pipe-route'

export function createPipeRoute(fromNode: AnyNode, from: NodePort, toNode: AnyNode, to: NodePort) {
  const scene = useScene.getState()
  const plan = planDwvConnection(from, to)
  if (!plan) throw new Error('Choose sockets with matching sizes and systems.')
  const levelId = findLevelAncestorId(fromNode.id, scene.nodes)
  if (!levelId || findLevelAncestorId(toNode.id, scene.nodes) !== levelId) throw new Error('Both items must be on the same level.')
  const fittingDefinition = nodeRegistry.get('pipe-fitting')
  if (!fittingDefinition?.ports || !nodeRegistry.get('pipe-segment')) throw new Error('Load the editor pipe and fitting tools first.')
  const template = PipeFittingNode.parse({ fittingType: 'elbow', angle: 90, diameter: plan.diameter, diameter2: plan.diameter, pipeMaterial: 'pvc', system: plan.system })
  const nativePorts = fittingDefinition.ports(template)
  const inlet = nativePorts.find((p) => p.id === 'inlet')
  const outlet = nativePorts.find((p) => p.id === 'outlet')
  if (!inlet || !outlet) throw new Error('The editor elbow is missing connection sockets.')
  const leg = Math.max(new Vector3(...inlet.position).length(), new Vector3(...outlet.position).length())
  const radius = plan.diameter * 0.0254 / 2
  const lead = Math.max(0.3, plan.diameter * 0.0254 * 5 + leg)
  const level = sceneRegistry.nodes.get(levelId as never)
  if (!level) throw new Error('Wait for the scene to load before creating a route.')
  level.updateWorldMatrix(true, true)
  const inverse = level.matrixWorld.clone().invert()
  // Align routing axes with the source equipment while keeping vertical runs vertical.
  const xAxis = new Vector3(from.direction[0], 0, from.direction[2])
  if (xAxis.lengthSq() < 1e-8) xAxis.set(to.direction[0], 0, to.direction[2])
  if (xAxis.lengthSq() < 1e-8) xAxis.set(1, 0, 0)
  xAxis.normalize()
  const up = new Vector3(0, 1, 0)
  const routeFrame = new Matrix4().makeBasis(xAxis, up, xAxis.clone().cross(up))
  const toRoute = routeFrame.clone().invert()
  const ancestors = (node: AnyNode) => {
    const ids = new Set<string>()
    let current: AnyNode | undefined = node
    while (current && !ids.has(current.id)) { ids.add(current.id); current = current.parentId ? scene.nodes[current.parentId as keyof typeof scene.nodes] : undefined }
    return ids
  }
  const startHosts = ancestors(fromNode), endHosts = ancestors(toNode)
  const requiredGeometry = new Set([
    'pool:pool', 'pool:pump', 'pool:filter', 'pool:heater', 'pool:valve',
    'pool:drain', 'pool:inlet', 'pool:skimmer', 'pool:stair', 'pool:waterfall',
  ])
  const obstacles: RouteObstacle[] = []
  let belowY = Math.min(-0.3, plan.start[1] - lead, plan.end[1] - lead)
  for (const node of Object.values(scene.nodes)) {
    if (!node || findLevelAncestorId(node.id, scene.nodes) !== levelId || ['level', 'group', 'building'].includes(node.type)) continue
    const isEndpoint = node.id === fromNode.id || node.id === toNode.id
    const hidden = [...ancestors(node)].some((id) => scene.nodes[id as keyof typeof scene.nodes]?.visible === false)
    if (hidden && !isEndpoint) continue
    let object = sceneRegistry.nodes.get(node.id)
    let objectOwnerId: string = node.id
    // Composite renderers can own a child's geometry without registering a separate child group.
    if (!object) {
      for (const id of ancestors(node)) {
        if (id === levelId) break
        const parentObject = sceneRegistry.nodes.get(id as never)
        if (parentObject) { object = parentObject; objectOwnerId = id; break }
      }
    }
    if (!object) {
      if (isEndpoint || requiredGeometry.has(String(node.type))) {
        const label = node.name ?? nodeRegistry.get(node.type)?.presentation?.label ?? node.type
        throw new Error(`Cannot check pipe clearance for "${label}" (${node.id}). Its 3D geometry is unavailable. Show the item in the 3D view and try again.`)
      }
      continue
    }
    const box = new Box3().setFromObject(object).applyMatrix4(inverse).applyMatrix4(toRoute)
    if (box.isEmpty()) continue
    // Inflate for pipe thickness and the complete elbow envelope, not just its centerline.
    box.expandByScalar(leg + radius * 1.3 + 0.025)
    if (String(node.type) === 'pool:pool' || node.type === 'slab') belowY = Math.min(belowY, box.min.y - lead)
    obstacles.push({ min: box.min.toArray() as RoutePoint, max: box.max.toArray() as RoutePoint, startHost: startHosts.has(objectOwnerId), endHost: endHosts.has(objectOwnerId) })
  }
  const inFrame = (point: readonly number[]) => new Vector3(point[0], point[1], point[2]).applyMatrix4(toRoute).toArray() as RoutePoint
  const routed = routePipe(inFrame(plan.start), inFrame(plan.end), inFrame(from.direction), inFrame(to.direction), obstacles, lead, leg, belowY)
  if (!routed) throw new Error('No clear underground route found. Leave room for the socket pipes to turn downward; the route cannot pass through a solid floor or pool shell.')
  const path = routed.map((point) => new Vector3(...point).applyMatrix4(routeFrame).toArray() as RoutePoint)
  const fittings: PipeFittingNode[] = []
  const starts = path.slice(0, -1).map((p) => [...p] as RoutePoint)
  const ends = path.slice(1).map((p) => [...p] as RoutePoint)
  for (let i = 1; i < path.length - 1; i++) {
    const incoming = new Vector3(...path[i]!).sub(new Vector3(...path[i - 1]!)).normalize()
    const outgoing = new Vector3(...path[i + 1]!).sub(new Vector3(...path[i]!)).normalize()
    const z = outgoing.clone().addScaledVector(incoming, -incoming.dot(outgoing)).normalize()
    const y = z.clone().cross(incoming).normalize()
    const rotation = new Euler().setFromRotationMatrix(new Matrix4().makeBasis(incoming, y, z))
    const angle = Math.round(Math.acos(Math.max(-1, Math.min(1, incoming.dot(outgoing)))) * 180 / Math.PI / 22.5) * 22.5
    const fitting = PipeFittingNode.parse({ ...template, id: undefined, name: 'Pool pipe elbow', position: path[i], rotation: [rotation.x, rotation.y, rotation.z], angle })
    const ports = fittingDefinition.ports(fitting)
    ends[i - 1] = [...ports.find((p) => p.id === 'inlet')!.position]
    starts[i] = [...ports.find((p) => p.id === 'outlet')!.position]
    fittings.push(fitting)
  }
  const pipes = starts.map((start, i) => PipeSegmentNode.parse({ name: 'Pool connection pipe', diameter: plan.diameter, pipeMaterial: 'pvc', system: plan.system, path: [start, ends[i]!] }))
  const members = [...pipes, ...fittings]
  scene.applyNodeChanges({ create: members.map((node) => ({ node, parentId: levelId as never })) })
  return { pipes: pipes.length, elbows: fittings.length }
}
