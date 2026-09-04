type PipePointerGuardOptions = {
  target: EventTarget
  getInputDragging: () => boolean
  setInputDragging: (value: boolean) => void
}

type PointerEventLike = Event & { pointerId?: number }

/**
 * Keeps the editor's canvas marquee from taking ownership of a pointer that
 * belongs to a PVC part. The canvas listener may have armed itself before the
 * R3F handler runs, so the guard stays active until the matching release and
 * lets marquee cancel itself on the first move/up event.
 */
export function createPipePointerGuard({
  target,
  getInputDragging,
  setInputDragging,
}: PipePointerGuardOptions) {
  let activePointerId: number | null = null
  let previousInputDragging = false

  const removeListeners = () => {
    target.removeEventListener('pointerup', onPointerEnd)
    target.removeEventListener('pointercancel', onPointerEnd)
    target.removeEventListener('blur', onBlur)
  }

  const restore = (event?: PointerEventLike) => {
    if (activePointerId === null) return
    if (event && typeof event.pointerId === 'number' && event.pointerId !== activePointerId) return

    removeListeners()
    activePointerId = null
    setInputDragging(previousInputDragging)
  }

  function onPointerEnd(event: Event) {
    restore(event as PointerEventLike)
  }

  function onBlur() {
    restore()
  }

  return {
    begin(event: PointerEventLike) {
      if (typeof event.pointerId !== 'number') return
      if (activePointerId === event.pointerId) return
      if (activePointerId !== null) restore()

      activePointerId = event.pointerId
      previousInputDragging = getInputDragging()
      setInputDragging(true)
      target.addEventListener('pointerup', onPointerEnd)
      target.addEventListener('pointercancel', onPointerEnd)
      target.addEventListener('blur', onBlur)
    },
    dispose() {
      restore()
    },
  }
}
