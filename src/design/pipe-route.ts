import { Vector3 } from 'three'

export type RoutePoint = [number, number, number]
export type RouteObstacle = { min: RoutePoint; max: RoutePoint; startHost?: boolean; endHost?: boolean }
const EPS = 1e-6
const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]

export function segmentHitsBox(a: RoutePoint, b: RoutePoint, box: RouteObstacle): boolean {
  let low = 0, high = 1
  for (let axis = 0; axis < 3; axis++) {
    const delta = b[axis]! - a[axis]!
    if (Math.abs(delta) < EPS) {
      if (a[axis]! < box.min[axis]! || a[axis]! > box.max[axis]!) return false
    } else {
      const t1 = (box.min[axis]! - a[axis]!) / delta
      const t2 = (box.max[axis]! - a[axis]!) / delta
      low = Math.max(low, Math.min(t1, t2))
      high = Math.min(high, Math.max(t1, t2))
      if (low > high) return false
    }
  }
  return true
}

function contains(box: RouteObstacle, point: RoutePoint) {
  return point.every((value, axis) => value >= box.min[axis]! && value <= box.max[axis]!)
}

function simplify(points: RoutePoint[]): RoutePoint[] {
  const result: RoutePoint[] = []
  for (const point of points) {
    if (result.length && new Vector3(...point).distanceTo(new Vector3(...result.at(-1)!)) < EPS) continue
    while (result.length > 1) {
      const a = new Vector3(...result.at(-1)!).sub(new Vector3(...result.at(-2)!)).normalize()
      const b = new Vector3(...point).sub(new Vector3(...result.at(-1)!)).normalize()
      if (a.dot(b) < 1 - EPS) break
      result.pop()
    }
    result.push(point)
  }
  return result
}

/** Conservative box routing: failed searches never fall back to a colliding chord. */
export function routePipe(
  start: RoutePoint, end: RoutePoint, startDirection: RoutePoint, endDirection: RoutePoint,
  obstacles: RouteObstacle[], lead: number, fittingLeg: number,
  belowY?: number,
  allowComplex = true,
  endLead = lead,
  maxY = Infinity,
): RoutePoint[] | null {
  const directions = [new Vector3(...startDirection), new Vector3(...endDirection)]
  if (directions.some((d) => !Number.isFinite(d.length()) || d.length() < EPS)) return null
  directions.forEach((d) => d.normalize())
  const endpoints = [start, end]
  const tips = endpoints.map((point, index) => {
    const approach = index === 1 ? endLead : lead
    let length = approach
    const direction = directions[index]!
    for (const box of obstacles) {
      if (!contains(box, point) || !(index === 0 ? box.startHost : box.endHost)) continue
      const exits = [0, 1, 2].flatMap((axis) => {
        const component = direction.getComponent(axis)
        if (Math.abs(component) < EPS) return []
        return [((component > 0 ? box.max[axis]! : box.min[axis]!) - point[axis]!) / component]
      })
      length = Math.max(length, Math.min(...exits) + approach)
    }
    return new Vector3(...point).addScaledVector(direction, length).toArray() as RoutePoint
  })
  // Only the straight socket approach may leave the box containing that socket.
  for (let i = 0; i < 2; i++) {
    if (obstacles.some((box) => !(contains(box, endpoints[i]!) && (i === 0 ? box.startHost : box.endHost)) && segmentHitsBox(endpoints[i]!, tips[i]!, box))) return null
  }
  const clear = (points: RoutePoint[]) => points.slice(1).every((point, i) => !obstacles.some((box) => segmentHitsBox(points[i]!, point, box)))
  const orthogonal = (a: RoutePoint, b: RoutePoint, order: number[]) => {
    const points: RoutePoint[] = [[...a]]
    for (const axis of order) { const next: RoutePoint = [...points.at(-1)!]; next[axis] = b[axis]!; points.push(next) }
    return points
  }
  let best: RoutePoint[] | null = null, bestCost = Infinity
  const consider = (middle: RoutePoint[]) => {
    if (middle.some(point => point[1] > maxY + EPS)) return
    if (!clear(middle)) return
    const route = simplify([start, ...middle, end])
    const vectors = route.slice(1).map((p, i) => new Vector3(...p).sub(new Vector3(...route[i]!)))
    if (vectors.some((v, i) => v.length() + EPS < fittingLeg * ((i > 0 ? 1 : 0) + (i < vectors.length - 1 ? 1 : 0)) + 0.05)) return
    for (let i = 1; i < vectors.length; i++) {
      const dot = vectors[i - 1]!.clone().normalize().dot(vectors[i]!.clone().normalize())
      const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI
      if (![22.5, 45, 90].some((standard) => Math.abs(angle - standard) < 0.01)) return
    }
    const cost = vectors.reduce((total, v) => total + v.length(), 0) + (route.length - 2) * lead * 2
    if (cost < bestCost) { best = route; bestCost = cost }
  }
  if (belowY !== undefined) {
    const margin = Math.max(lead, fittingLeg * 2 + 0.05)
    const depth = Math.min(belowY, tips[0]![1] - margin, tips[1]![1] - margin)
    const approaches = tips.map((tip, index) => {
      const offsets = [[0, 0], [margin, 0], [-margin, 0], [0, margin], [0, -margin]]
      // Top sockets must clear their equipment footprint before dropping.
      // Arbitrary obstacle edges would allow long above-ground slab detours.
      for (const box of obstacles) {
        if (!(index === 0 ? box.startHost : box.endHost)) continue
        offsets.push(
          [box.min[0] - margin - tip[0], 0],
          [box.max[0] + margin - tip[0], 0],
          [0, box.min[2] - margin - tip[2]],
          [0, box.max[2] + margin - tip[2]],
        )
      }
      return offsets.map(([x, z]) => {
        const turn: RoutePoint = [tip[0] + x!, tip[1], tip[2] + z!]
        return [tip, turn, [turn[0], depth, turn[2]] as RoutePoint]
      }).filter(clear)
    })
    for (const a of approaches[0]!) for (const b of approaches[1]!) {
      for (const order of [[0, 2, 1], [2, 0, 1]]) {
        consider([...a, ...orthogonal(a.at(-1)!, b.at(-1)!, order), ...[...b].reverse()])
      }
    }
    // An underground request must never fall back to an overhead corridor.
    return best
  }
  for (const order of orders) consider(orthogonal(tips[0]!, tips[1]!, order))
  // Candidate corridors run outside obstacle faces, with enough room for two elbows.
  for (let axis = 0; axis < 3; axis++) {
    const margin = Math.max(lead, fittingLeg * 2 + 0.05)
    const lanes = new Set(obstacles.flatMap((box) => [box.min[axis]! - margin, box.max[axis]! + margin]))
    if (axis === 1 && Number.isFinite(maxY)) lanes.add(maxY)
    lanes.add(Math.min(tips[0]![axis]!, tips[1]![axis]!) - margin)
    lanes.add(Math.max(tips[0]![axis]!, tips[1]![axis]!) + margin)
    const midpoint = (tips[0]![axis]! + tips[1]![axis]!) / 2
    for (const lane of [...lanes].sort((a, b) => Math.abs(a - midpoint) - Math.abs(b - midpoint)).slice(0, 64)) {
      const a: RoutePoint = [...tips[0]!], b: RoutePoint = [...tips[1]!]
      a[axis] = lane; b[axis] = lane
      for (const order of orders) consider([tips[0]!, ...orthogonal(a, b, order), tips[1]!])
    }
  }
  if (!best && allowComplex) {
    const margin = Math.max(lead, fittingLeg * 2 + 0.05)
    for (const [first, second] of [[0, 1], [0, 2], [1, 2]]) {
      const lanes = (axis: number) => [...new Set([...obstacles.flatMap(box => [box.min[axis]! - margin, box.max[axis]! + margin]), ...(axis === 1 ? [maxY, tips[0]![1], tips[1]![1], (tips[0]![1] + tips[1]![1]) / 2] : [])])]
        .filter(Number.isFinite).sort((a, b) => Math.abs(a - tips[0]![axis]!) - Math.abs(b - tips[0]![axis]!)).slice(0, 12)
      for (const x of lanes(first!)) for (const y of lanes(second!)) {
        const a: RoutePoint = [...tips[0]!], b: RoutePoint = [...tips[1]!]
        a[first!] = b[first!] = x
        a[second!] = b[second!] = y
        for (const entry of orders) for (const exit of orders) {
          consider([...orthogonal(tips[0]!, a, entry), b, ...orthogonal(b, tips[1]!, exit)])
          if (best) return best
        }
      }
    }
  }
  return best
}
