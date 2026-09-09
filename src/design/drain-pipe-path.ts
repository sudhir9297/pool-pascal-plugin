import { Vector3 } from 'three'

type Port = { position: Vector3; direction: Vector3 }

/** Collect aligned drains along a branch before joining the common pipe. */
export function drainPipePath(ports: Port[], corners: Vector3[], exitCorner: number, y: number, extension: number) {
  const vertices: { point: Vector3; terminal: boolean; neighbors: number[] }[] = []
  const add = (point: Vector3, terminal = false) => { vertices.push({ point, terminal, neighbors: [] }); return vertices.length - 1 }
  const join = (a: number, b: number) => { vertices[a]!.neighbors.push(b); vertices[b]!.neighbors.push(a) }
  const span = (axis: 'x' | 'z') => Math.max(...ports.map((port) => port.position[axis])) - Math.min(...ports.map((port) => port.position[axis]))
  const gap = (axis: 'x' | 'z') => {
    const stations = ports.map((port) => port.position[axis]).sort((a, b) => a - b)
    const gaps = stations.slice(1).map((value, i) => value - stations[i]!).filter((value) => value > 1e-6)
    return gaps.length ? Math.min(...gaps) : Infinity
  }
  const xGap = gap('x'), zGap = gap('z')
  const axis = xGap === zGap ? (span('x') >= span('z') ? 'x' : 'z') : xGap > zGap ? 'x' : 'z'
  const cross = axis === 'x' ? 'z' : 'x'
  const exit = corners[exitCorner]!.clone()
  const groups: { station: number; ports: Port[] }[] = []
  for (const port of ports) {
    if (port.direction.y > -0.999999) throw new Error('Drain suction sockets must point downward.')
    const group = groups.find((candidate) => Math.abs(candidate.station - port.position[axis]) < 1e-6)
    if (group) group.ports.push(port)
    else groups.push({ station: port.position[axis], ports: [port] })
  }
  groups.sort((a, b) => Math.abs(b.station - exit[axis]) - Math.abs(a.station - exit[axis]))
  let previous: number | undefined
  for (const group of groups) {
    group.ports.sort((a, b) => Math.abs(b.position[cross] - exit[cross]) - Math.abs(a.position[cross] - exit[cross]))
    let branch: number | undefined
    for (const port of group.ports) {
      const lower = port.position.clone(); lower.y = y
      const junction = add(lower)
      join(add(port.position, true), junction)
      if (branch !== undefined) join(branch, junction)
      branch = junction
    }
    const point = exit.clone(); point[axis] = group.station
    const header = add(point)
    join(branch!, header)
    if (previous !== undefined) join(previous, header)
    previous = header
  }
  const direction = exit.clone().sub(vertices[previous!]!.point).normalize()
  const freeEnd = add(exit.addScaledVector(direction, extension), true)
  join(previous!, freeEnd)
  return { vertices, freeEnd }
}
