import { PipeFittingNode, PipeSegmentNode, type NodePort } from '@pascal-app/core'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'
import { resolvePoolPolygon, type PoolNode } from '../core/schema'
import { getPoolDepthRange } from './depth-profile'
import { drainPipePath } from './drain-pipe-path'
import { poolOutlineDistance } from './pool-pipe-outline'
import { isPoolPolygonPlaceable } from './shapes'

export type PoolPipeCircuit = 'inlets' | 'skimmers' | 'drains'
export type PoolPipeOptions = { circuit: PoolPipeCircuit; exitCorner: number; clearance: number; drop: number }
export const DEFAULT_POOL_PIPE_OPTIONS: PoolPipeOptions = { circuit: 'inlets', exitCorner: 0, clearance: 0.8, drop: 0 }
type Point = [number, number, number]
type Vertex = { point: Vector3; terminal: boolean; neighbors: number[] }
export type PoolPipeLayout = ReturnType<typeof planPoolPipes>

/** Plan in pool space, then trim every pipe to the host fitting's actual collars. */
export function planPoolPipes(
  pool: PoolNode,
  ports: readonly NodePort[],
  options: PoolPipeOptions,
  fittingPorts: (node: PipeFittingNode) => readonly NodePort[],
  suctionOffset = 0,
) {
  const drains = options.circuit === 'drains'
  const skimmers = options.circuit === 'skimmers'
  const label = options.circuit
  const pipeName = drains ? 'Pool drain' : skimmers ? 'Pool skimmer' : 'Pool return'
  if (!ports.length) throw new Error(`Add ${label} to this pool first.`)
  if (Math.abs(pool.rotation[0]) > 1e-6 || Math.abs(pool.rotation[2]) > 1e-6) throw new Error('The pool must be level to connect its pipes.')
  if (!Number.isInteger(options.exitCorner) || options.exitCorner < 0 || options.exitCorner > 3) throw new Error('Choose an exit corner.')
  if (!Number.isFinite(options.clearance) || options.clearance <= pool.shellThickness || !Number.isFinite(options.drop) || options.drop < 0) throw new Error('Use a wall distance greater than the shell thickness and a non-negative depth.')
  const diameter = ports[0]!.diameter
  const system = ports[0]!.system
  if (!diameter || ports.some((port) => !port.diameter || Math.abs(port.diameter - diameter) > 0.001 || port.system !== system || !port.position.every(Number.isFinite))) throw new Error(`All ${label} sockets must have matching sizes and systems.`)
  const template = PipeFittingNode.parse({ diameter, diameter2: diameter, system, pipeMaterial: 'pvc', angle: 90 })
  const fittingLeg = Math.max(...fittingPorts(template).map((port) => new Vector3(...port.position).length()))
  const fittingEnvelope = fittingLeg + diameter * 0.0254 / 2
  const rotation = new Quaternion().setFromEuler(new Euler(...pool.rotation))
  const inverse = rotation.clone().invert()
  const localPorts = ports.map((port) => ({
    position: new Vector3(...port.position).sub(new Vector3(...pool.position)).applyQuaternion(inverse),
    direction: new Vector3(...port.direction).applyQuaternion(inverse).normalize(),
  }))
  const polygon = resolvePoolPolygon(pool)
  if (!isPoolPolygonPlaceable(polygon)) throw new Error('The pool outline must be a valid closed polygon.')
  const rectangular = polygon.length === 4 && polygon.every((p, i) => {
    const next = polygon[(i + 1) % polygon.length]!
    return Math.abs(p[0] - next[0]) < 1e-6 || Math.abs(p[1] - next[1]) < 1e-6
  })
  const underground = drains || !rectangular
  const minX = Math.min(...polygon.map(([x]) => x)), maxX = Math.max(...polygon.map(([x]) => x))
  const minZ = Math.min(...polygon.map(([, z]) => z)), maxZ = Math.max(...polygon.map(([, z]) => z))
  const margin = options.clearance + (rectangular || drains ? 0 : fittingEnvelope + 0.1)
  const x0 = Math.min(minX, ...(!rectangular && !drains ? localPorts.map((p) => p.position.x) : [])) - margin
  const x1 = Math.max(maxX, ...(!rectangular && !drains ? localPorts.map((p) => p.position.x) : [])) + margin
  const z0 = Math.min(minZ, ...(!rectangular && !drains ? localPorts.map((p) => p.position.z) : [])) - margin
  const z1 = Math.max(maxZ, ...(!rectangular && !drains ? localPorts.map((p) => p.position.z) : [])) + margin
  const width = x1 - x0, height = z1 - z0, perimeter = 2 * (width + height)
  const cornerStations = [0, width, width + height, 2 * width + height]
  const floorBottom = pool.finishedDeckElevation - getPoolDepthRange(pool).maximum - pool.floorThickness
  const lowest = Math.min(...localPorts.map((port) => port.position.y))
  // Leave room for the outlet elbow without tying the suction run to basin depth.
  const y = (underground ? Math.min(lowest - fittingLeg - 0.055, floorBottom - fittingEnvelope - 0.025) : lowest - (skimmers ? fittingLeg + 0.055 : 0)) - options.drop
  const wrap = (s: number) => ((s % perimeter) + perimeter) % perimeter
  const at = (station: number) => {
    const s = wrap(station)
    if (s <= width) return new Vector3(x0 + s, y, z0)
    if (s <= width + height) return new Vector3(x1, y, z0 + s - width)
    if (s <= 2 * width + height) return new Vector3(x1 - (s - width - height), y, z1)
    return new Vector3(x0, y, z1 - (s - 2 * width - height))
  }
  let corners = cornerStations.map(at)
  let vertices: Vertex[]
  let freeEnd: number
  if (drains) {
    if (localPorts.some(({ position: p }) => poolOutlineDistance(p, polygon) >= 0)) throw new Error('Each drain must sit inside the pool floor.')
    const path = drainPipePath(localPorts, corners, options.exitCorner, y, Math.max(0.5, options.clearance))
    vertices = path.vertices
    freeEnd = path.freeEnd
  } else if (!rectangular) {
    const spacing = 2 * (fittingLeg + diameter * 0.0254 / 2 * 1.3) + 0.035
    const leads = localPorts.map(() => options.clearance)
    if (!skimmers) {
      const score = (points: Vector3[]) => Math.max(...(['x', 'z'] as const).map((axis) => {
        const values = points.map((p) => p[axis]).sort((a, b) => a - b)
        const gaps = values.slice(1).map((v, i) => v - values[i]!).filter((v) => v > 1e-6)
        return gaps.length ? Math.min(...gaps) : Infinity
      }))
      // Stagger outlet leads when curved walls project sockets too close on the collector.
      for (let attempt = 0; attempt < 24; attempt++) {
        const points = localPorts.map((port, i) => port.position.clone().addScaledVector(port.direction, leads[i]!))
        if (score(points) >= spacing) break
        for (let i = 0; i < leads.length; i++) leads[i] = options.clearance + (attempt + 1) * spacing * (i + 1) / leads.length
      }
    }
    const approaches = localPorts.map((port, index) => {
      if (skimmers) {
        if (port.direction.y > -0.999999) throw new Error('Skimmer suction sockets must point downward.')
        if (poolOutlineDistance(port.position, polygon) < pool.shellThickness) throw new Error('The skimmer outlet must clear the pool shell.')
        if (!suctionOffset) return port.position.clone()
        let nearest = port.position.clone(), distance = Infinity
        for (let i = 0; i < polygon.length; i++) {
          const a = new Vector3(polygon[i]![0], port.position.y, polygon[i]![1])
          const b = new Vector3(polygon[(i + 1) % polygon.length]![0], port.position.y, polygon[(i + 1) % polygon.length]![1])
          const edge = b.sub(a)
          const point = a.addScaledVector(edge, Math.max(0, Math.min(1, port.position.clone().sub(a).dot(edge) / edge.lengthSq())))
          if (point.distanceToSquared(port.position) < distance) { nearest = point; distance = point.distanceToSquared(port.position) }
        }
        const direction = port.position.clone().sub(nearest).normalize()
        const tip = port.position.clone().addScaledVector(direction, suctionOffset)
        tip.y -= fittingLeg + 0.08
        for (let step = 1; step <= 20; step++) {
          if (poolOutlineDistance(port.position.clone().lerp(tip, step / 20), polygon) < pool.shellThickness) throw new Error('The skimmer branch crosses the pool shell.')
        }
        return tip
      }
      if (Math.abs(port.direction.y) > 1e-6) throw new Error('Inlet sockets must point out from the pool wall.')
      const tip = port.position.clone().addScaledVector(port.direction, leads[index]!)
      const clearance = pool.shellThickness + fittingEnvelope
      if (poolOutlineDistance(tip, polygon) < clearance) throw new Error('Increase the distance from the pool to keep fittings clear of the shell.')
      const steps = Math.ceil(leads[index]! / 0.025)
      for (let step = 1; step <= steps; step++) {
        const point = port.position.clone().lerp(tip, step / steps)
        if (poolOutlineDistance(point, polygon) < pool.shellThickness) throw new Error('An inlet branch crosses the pool shell. Reduce the distance or move the inlet.')
      }
      return tip
    })
    const left = Math.min(x0, ...approaches.map((p) => p.x - spacing))
    const right = Math.max(x1, ...approaches.map((p) => p.x + spacing))
    const top = Math.min(z0, ...approaches.map((p) => p.z - spacing))
    const bottom = Math.max(z1, ...approaches.map((p) => p.z + spacing))
    corners = [[left, top], [right, top], [right, bottom], [left, bottom]].map(([x, z]) => new Vector3(x, y, z))
    const path = drainPipePath(approaches.map((position) => ({ position, direction: new Vector3(0, -1, 0) })), corners, options.exitCorner, y, Math.max(0.5, options.clearance))
    vertices = path.vertices
    freeEnd = path.freeEnd
    if (!skimmers || suctionOffset > 0) for (const [index, tip] of approaches.entries()) {
      const junction = vertices.findIndex((vertex) => vertex.terminal && vertex.point === tip)
      vertices[junction]!.terminal = false
      let previous = junction
      if (skimmers) {
        const neck = localPorts[index]!.position.clone(); neck.y = tip.y
        previous = vertices.length
        vertices.push({ point: neck, terminal: false, neighbors: [junction] })
        vertices[junction]!.neighbors.push(previous)
      }
      const socket = vertices.length
      vertices.push({ point: localPorts[index]!.position, terminal: true, neighbors: [previous] })
      vertices[previous]!.neighbors.push(socket)
    }
  } else {
    const stations = localPorts.map(({ position: p, direction: socketDirection }) => {
      if (skimmers && socketDirection.y > -0.999999) throw new Error('Skimmer suction sockets must point downward.')
      const d = skimmers
        ? new Vector3(p.x <= minX ? -1 : p.x >= maxX ? 1 : 0, 0, p.z <= minZ ? -1 : p.z >= maxZ ? 1 : 0)
        : socketDirection
      if (d.z < -0.999999 && p.x > minX && p.x < maxX && p.z <= minZ) return p.x - x0
      if (d.x > 0.999999 && p.z > minZ && p.z < maxZ && p.x >= maxX) return width + p.z - z0
      if (d.z > 0.999999 && p.x > minX && p.x < maxX && p.z >= maxZ) return width + height + x1 - p.x
      if (d.x < -0.999999 && p.z > minZ && p.z < maxZ && p.x <= minX) return 2 * width + height + z1 - p.z
      throw new Error('Each socket must be mounted on a rectangular pool wall.')
    })
    const exit = cornerStations[options.exitCorner]!
    const distance = (s: number, sign: number) => wrap((s - exit) * sign)
    const sign = Math.max(...stations.map((s) => distance(s, 1))) <= Math.max(...stations.map((s) => distance(s, -1))) ? 1 : -1
    const farthest = Math.max(...stations.map((s) => distance(s, sign)))
    const stops = [
      ...stations.map((s, inlet) => ({ s, inlet, d: distance(s, sign) })),
      ...cornerStations.map((s) => ({ s, inlet: -1, d: distance(s, sign) })).filter(({ d }) => d > 1e-6 && d < farthest - 1e-6),
    ].sort((a, b) => b.d - a.d)
    vertices = []
    const add = (point: Vector3, terminal = false) => { vertices.push({ point, terminal, neighbors: [] }); return vertices.length - 1 }
    const join = (a: number, b: number) => { vertices[a]!.neighbors.push(b); vertices[b]!.neighbors.push(a) }
    let previous: number | undefined
    for (const stop of stops) {
      const point = at(stop.s)
      const junction = add(point)
      if (previous !== undefined) join(previous, junction)
      previous = junction
      if (stop.inlet < 0) continue
      const port = localPorts[stop.inlet]!
      if (!skimmers && point.clone().sub(port.position).dot(port.direction) <= 0) throw new Error(`Increase the distance from the pool to clear the ${label}.`)
      let branch = add(port.position, true)
      if (skimmers) {
        const lower = port.position.clone(); lower.y = y
        if (suctionOffset > 0) {
          const neck = port.position.clone(); neck.y -= fittingLeg + 0.08
          const direction = point.clone().sub(lower).normalize()
          const tip = neck.clone().addScaledVector(direction, suctionOffset)
          lower.addScaledVector(direction, suctionOffset)
          const a = add(neck), b = add(tip)
          join(branch, a); join(a, b); branch = b
        }
        const elbow = add(lower)
        join(branch, elbow); branch = elbow
      } else if (Math.abs(port.position.y - y) > 1e-6) {
        const upper = port.position.clone().lerp(point, 0.5); upper.y = port.position.y
        const lower = upper.clone(); lower.y = y
        const a = add(upper), b = add(lower)
        join(branch, a); join(a, b); branch = b
      }
      join(branch, junction)
    }
    const exitPoint = at(exit)
    const tangent = exitPoint.clone().sub(vertices[previous!]!.point).normalize()
    freeEnd = add(exitPoint.addScaledVector(tangent, Math.max(0.5, options.clearance)), true)
    join(previous!, freeEnd)
  }
  const world = (point: Vector3) => point.clone().applyQuaternion(rotation).add(new Vector3(...pool.position))
  const collars = new Map<string, Vector3>()
  const fittings: PipeFittingNode[] = []
  for (const [i, vertex] of vertices.entries()) {
    if (vertex.terminal) continue
    const socketElbow = skimmers && vertex.neighbors.some((neighbor) => vertices[neighbor]!.terminal && neighbor !== freeEnd)
    // The outlet elbow shares the skimmer penetration; other fittings need full clearance.
    const wallClearance = pool.shellThickness + (socketElbow ? 0 : fittingEnvelope)
    if (vertex.point.y + fittingEnvelope >= floorBottom && poolOutlineDistance(vertex.point, polygon) < wallClearance) throw new Error('Increase the distance from the pool to keep fittings clear of the shell.')
    const directions = vertex.neighbors.map((n) => vertices[n]!.point.clone().sub(vertex.point).normalize().applyQuaternion(rotation))
    let x: Vector3, z: Vector3
    if (directions.length === 2) {
      x = directions[0]!.clone().negate(); z = directions[1]!
    } else {
      const branch = directions.findIndex((d, j) => directions.every((other, k) => j === k || Math.abs(d.dot(other)) < 1e-6))
      if (branch < 0) throw new Error(`The ${label} are too close to a corner or to each other. Move them apart.`)
      z = directions[branch]!; x = directions[(branch + 1) % 3]!
    }
    if (Math.abs(x.dot(z)) > 1e-6) throw new Error(`The ${label} are too close to a corner or to each other. Move them apart.`)
    const euler = new Euler().setFromRotationMatrix(new Matrix4().makeBasis(x, z.clone().cross(x), z))
    const fitting = PipeFittingNode.parse({ ...template, id: undefined, name: vertex.neighbors.length === 3 ? `${pipeName} tee` : `${pipeName} elbow`, fittingType: vertex.neighbors.length === 3 ? 'sanitary-tee' : 'elbow', position: world(vertex.point).toArray(), rotation: [euler.x, euler.y, euler.z] })
    const native = fittingPorts(fitting)
    for (const [j, neighbor] of vertex.neighbors.entries()) {
      const port = native.find((p) => new Vector3(...p.direction).dot(directions[j]!) > 1 - 1e-6)
      if (!port) throw new Error('The editor fitting sockets do not match this route.')
      collars.set(`${i}:${neighbor}`, new Vector3(...port.position))
    }
    fittings.push(fitting)
  }
  const pipes: PipeSegmentNode[] = []
  const preview: [Point, Point][] = []
  for (const [i, vertex] of vertices.entries()) for (const neighbor of vertex.neighbors) {
    if (neighbor < i) continue
    const other = vertices[neighbor]!
    const start = collars.get(`${i}:${neighbor}`) ?? world(vertex.point)
    const end = collars.get(`${neighbor}:${i}`) ?? world(other.point)
    const direction = world(other.point).sub(world(vertex.point)).normalize()
    if (end.clone().sub(start).dot(direction) < 0.05) throw new Error('There is not enough room for the fittings. Increase pipe distance or depth, or move nearby attachments apart.')
    pipes.push(PipeSegmentNode.parse({ name: neighbor === freeEnd ? `${pipeName} connection` : `${pipeName} pipe`, diameter, system, pipeMaterial: 'pvc', path: [start.toArray(), end.toArray()] }))
    preview.push([vertex.point.toArray(), other.point.toArray()])
  }
  return { pipes, fittings, preview, freeEnd: world(vertices[freeEnd]!.point).toArray() as Point, freeEndLocal: vertices[freeEnd]!.point.toArray() as Point, corners: corners.map((point) => point.toArray() as Point), polygon, attachmentCount: ports.length }
}
