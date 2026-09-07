'use client'

import { useNodeEvents } from '@pascal-app/viewer'
import { useRegistry, type AnyNode } from '@pascal-app/core'
import { useMemo, useRef } from 'react'
import { type Group } from 'three'
import { buildValveGeometry } from '../core/geometry'
import type { PoolValveNode } from '../core/schema'

export default function PoolValvePreview({ node }: { node: PoolValveNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildValveGeometry(node), [node])
  return <group position={node.position} rotation={node.rotation} ref={rootRef} {...handlers}>
    <primitive object={geometry} />
  </group>
}
