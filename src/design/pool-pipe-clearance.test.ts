import { expect, test } from 'bun:test'
import { PipeFittingNode, PipeSegmentNode } from '@pascal-app/core'
import { Vector3 } from 'three'
import { nativeFittingPorts } from '../../tests/pipe-fitting-ports'
import { pipeVolumes, pipeVolumesOverlap, segmentDistance } from './pool-pipe-clearance'

test('segment distances handle crossings, parallel overlaps, skew lines and points', () => {
  const v = (x: number, y = 0, z = 0) => new Vector3(x, y, z)
  expect(segmentDistance(v(-1), v(1), v(0, 0, -1), v(0, 0, 1))).toBe(0)
  expect(segmentDistance(v(-1), v(1), v(-0.5, 0.2), v(2, 0.2))).toBeCloseTo(0.2)
  expect(segmentDistance(v(-1), v(1), v(0, 0.3, -1), v(0, 0.3, 1))).toBeCloseTo(0.3)
  expect(segmentDistance(v(0, 0.5), v(0, 0.5), v(-1), v(1))).toBeCloseTo(0.5)
  expect(segmentDistance(v(0), v(0), v(1), v(1))).toBe(1)
  expect(segmentDistance(v(-1), v(1), v(2), v(3))).toBe(1)
})

test('clearance includes thickness, fitting collars and a gap; separate networks cannot share sockets', () => {
  const pipe = PipeSegmentNode.parse({ path: [[-2, 0, 0], [2, 0, 0]], diameter: 4 })
  const volume = pipeVolumes([pipe], [], nativeFittingPorts)
  const parallel = (y: number) => pipeVolumes([PipeSegmentNode.parse({ ...pipe, id: undefined, path: [[-1, y, 0], [1, y, 0]] })], [], nativeFittingPorts)
  expect(pipeVolumesOverlap(parallel(0.1), volume)).toBe(true)
  expect(pipeVolumesOverlap(parallel(0.2), volume)).toBe(false)
  const fitting = PipeFittingNode.parse({ position: [0, 0.1, 0] })
  expect(pipeVolumesOverlap(pipeVolumes([], [fitting], nativeFittingPorts), volume)).toBe(true)
  const touching = PipeSegmentNode.parse({ path: [[2, 0, 0], [3, 0, 0]] })
  expect(pipeVolumesOverlap(pipeVolumes([touching], [], nativeFittingPorts), volume)).toBe(true)
  const socket = nativeFittingPorts(fitting)[0]!
  const attached = PipeSegmentNode.parse({ path: [new Vector3(...socket.position).addScaledVector(new Vector3(...socket.direction), 1).toArray(), [...socket.position]] })
  expect(pipeVolumesOverlap(pipeVolumes([attached], [fitting], nativeFittingPorts))).toBe(false)
})
