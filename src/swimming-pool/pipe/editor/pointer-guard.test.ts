import { describe, expect, test } from 'bun:test'
import { createPipePointerGuard } from './pointer-guard'

function pointerEvent(type: string, pointerId: number): PointerEvent {
  const event = new Event(type)
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  return event as PointerEvent
}

describe('PVC pointer marquee guard', () => {
  test('cancels an already-armed marquee before pointer movement can start it', () => {
    const target = new EventTarget()
    let inputDragging = false
    let marqueeArmed = false
    let marqueeStarted = false
    const guard = createPipePointerGuard({
      target,
      getInputDragging: () => inputDragging,
      setInputDragging: (value) => { inputDragging = value },
    })

    // The editor canvas listener can run before the R3F pipe handler.
    marqueeArmed = !inputDragging
    guard.begin(pointerEvent('pointerdown', 7))

    if (marqueeArmed) {
      if (inputDragging) marqueeArmed = false
      else marqueeStarted = true
    }

    expect(marqueeStarted).toBe(false)
    expect(marqueeArmed).toBe(false)
    expect(inputDragging).toBe(true)

    target.dispatchEvent(pointerEvent('pointerup', 7))
    expect(inputDragging).toBe(false)
  })

  test('ignores another pointer release and restores on the matching release', () => {
    const target = new EventTarget()
    let inputDragging = false
    const guard = createPipePointerGuard({
      target,
      getInputDragging: () => inputDragging,
      setInputDragging: (value) => { inputDragging = value },
    })

    guard.begin(pointerEvent('pointerdown', 11))
    target.dispatchEvent(pointerEvent('pointerup', 12))
    expect(inputDragging).toBe(true)

    target.dispatchEvent(pointerEvent('pointerup', 11))
    expect(inputDragging).toBe(false)
  })

  test('restores the previous drag state on cancel, blur, and disposal', () => {
    for (const finish of ['pointercancel', 'blur', 'dispose'] as const) {
      const target = new EventTarget()
      let inputDragging = true
      const guard = createPipePointerGuard({
        target,
        getInputDragging: () => inputDragging,
        setInputDragging: (value) => { inputDragging = value },
      })

      guard.begin(pointerEvent('pointerdown', 19))
      inputDragging = false
      if (finish === 'dispose') guard.dispose()
      else target.dispatchEvent(finish === 'blur' ? new Event('blur') : pointerEvent(finish, 19))

      expect(inputDragging).toBe(true)
    }
  })
})
