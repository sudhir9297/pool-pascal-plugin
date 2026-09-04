import { describe, expect, test } from 'bun:test'
import { Group } from 'three'
import { pipeGizmoPortalTarget, syncPipeGizmoFrame } from './scene'

describe('PVC gizmo scene placement', () => {
  test('mounts controls beside the selected network so its outline cannot include them', () => {
    const parent = new Group()
    const networkRoot = new Group()
    const controls = new Group()
    parent.add(networkRoot)

    const mount = pipeGizmoPortalTarget(networkRoot)
    mount.add(controls)

    expect(mount).toBe(parent)
    expect(networkRoot.getObjectById(controls.id)).toBeUndefined()
  })

  test('copies the selected network local frame onto the sibling control frame', () => {
    const networkRoot = new Group()
    networkRoot.position.set(2, 3, 4)
    networkRoot.rotation.set(0.2, 0.4, 0.6)
    networkRoot.scale.set(1.5, 2, 0.5)
    const controls = new Group()

    syncPipeGizmoFrame(controls, networkRoot)

    expect(controls.position.toArray()).toEqual(networkRoot.position.toArray())
    expect(controls.quaternion.toArray()).toEqual(networkRoot.quaternion.toArray())
    expect(controls.scale.toArray()).toEqual(networkRoot.scale.toArray())
  })

  test('ignores the transient frame where a scene update detached the network root', () => {
    const controls = new Group()
    controls.position.set(3, 4, 5)

    expect(syncPipeGizmoFrame(controls, null)).toBe(false)
    expect(controls.position.toArray()).toEqual([3, 4, 5])
  })
})
