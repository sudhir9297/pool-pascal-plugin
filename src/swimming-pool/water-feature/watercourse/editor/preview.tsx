'use client'

import { useRegistry, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { buildWatercourseGeometry } from '../core/geometry'
import type { PoolWatercourseNode } from '../core/schema'

export default function PoolWatercoursePreview({ node }: { node: PoolWatercourseNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildWatercourseGeometry(node), [node])
  return <group position={node.position} rotation={node.rotation} ref={rootRef} {...handlers}><primitive object={geometry} /></group>
}
