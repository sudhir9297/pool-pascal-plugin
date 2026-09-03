'use client'

import { useRegistry, type AnyNode } from '@pascal-app/core'
import { useNodeEvents } from '@pascal-app/viewer'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import { buildCatchBasinGeometry } from '../core/geometry'
import type { PoolCatchBasinNode } from '../core/schema'

export default function PoolCatchBasinPreview({ node }: { node: PoolCatchBasinNode }) {
  const rootRef = useRef<Group>(null!)
  const handlers = useNodeEvents(node as unknown as AnyNode, node.type as never)
  useRegistry(node.id, node.type, rootRef)
  const geometry = useMemo(() => buildCatchBasinGeometry(node), [node])
  return <group position={node.position} rotation={node.rotation} ref={rootRef} {...handlers}><primitive object={geometry} /></group>
}
