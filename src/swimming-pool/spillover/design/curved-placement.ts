import type { PoolPoint } from '../../core/schema'

const dot = (a: PoolPoint, b: PoolPoint) => a[0] * b[0] + a[1] * b[1]

function crossings(polygon: PoolPoint[], normal: PoolPoint, tangent: PoolPoint, across: number) {
  return polygon.flatMap((a, index) => {
    const b = polygon[(index + 1) % polygon.length]!
    const start = dot(a, tangent)
    const end = dot(b, tangent)
    if (Math.abs(end - start) < 1e-8 || across < Math.min(start, end) || across > Math.max(start, end)) return []
    const t = (across - start) / (end - start)
    return [dot(a, normal) + t * (dot(b, normal) - dot(a, normal))]
  })
}

/** Sample a full facing run rather than requiring one long polygon edge. */
export function findCurvedSpillway(first: PoolPoint[], second: PoolPoint[], requestedWidth?: number) {
  const center = (points: PoolPoint[]): PoolPoint => points.reduce<PoolPoint>((sum, p) => [sum[0] + p[0] / points.length, sum[1] + p[1] / points.length], [0, 0])
  const a = center(first)
  const b = center(second)
  const distance = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (distance < 0.001) return null
  const normal: PoolPoint = [(b[0] - a[0]) / distance, (b[1] - a[1]) / distance]
  const tangent: PoolPoint = [-normal[1], normal[0]]
  const left = first.map((p) => dot(p, tangent))
  const right = second.map((p) => dot(p, tangent))
  const minimum = Math.max(Math.min(...left), Math.min(...right))
  const maximum = Math.min(Math.max(...left), Math.max(...right))
  const across = (minimum + maximum) / 2
  const width = Math.min(requestedWidth ?? 2, (maximum - minimum) * 0.8)
  if (width < 0.3) return null
  const samples: Array<[number, number, number]> = []
  for (let index = 0; index <= 40; index++) {
    const coordinate = across + (index / 40 - 0.5) * width
    const firstHits = crossings(first, normal, tangent, coordinate)
    const secondHits = crossings(second, normal, tangent, coordinate)
    if (!firstHits.length || !secondHits.length) return null
    const start = Math.max(...firstHits)
    const end = Math.min(...secondHits)
    if (Math.abs(end - start) > 20) return null
    if (samples.length && (end - start) * (samples[0]![2] - samples[0]![1]) < 0) return null
    samples.push([coordinate, start, end])
  }
  const middle = samples[20]!
  const point = (along: number): PoolPoint => [normal[0] * along + tangent[0] * across, normal[1] * along + tangent[1] * across]
  const firstPoint = point(middle[1])
  const secondPoint = point(middle[2])
  return {
    position: [...point((middle[1] + middle[2]) / 2)] as PoolPoint,
    rotation: Math.atan2(tangent[0], tangent[1]),
    length: Math.abs(middle[2] - middle[1]),
    width,
    poolPoints: [firstPoint, secondPoint] as [PoolPoint, PoolPoint],
    firstEdge: samples.map(([u, x]): PoolPoint => [u - across, x - middle[1]]),
    secondEdge: samples.map(([u, , x]): PoolPoint => [u - across, x - middle[2]]),
  }
}

export function sampleSpilloverEdge(edge: PoolPoint[], across: number) {
  if (!edge.length) return 0
  if (across <= edge[0]![0]) return edge[0]![1]
  for (let index = 1; index < edge.length; index++) {
    const a = edge[index - 1]!
    const b = edge[index]!
    if (across <= b[0]) return a[1] + (b[1] - a[1]) * (across - a[0]) / Math.max(1e-8, b[0] - a[0])
  }
  return edge[edge.length - 1]![1]
}
