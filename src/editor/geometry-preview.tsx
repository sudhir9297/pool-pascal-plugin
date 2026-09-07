'use client'

import { type ReactNode, useEffect, useMemo, useRef } from 'react'
import { type Group, type Object3D } from 'three'
import { disposeObject3D } from './dispose-object'
import { usePoolNodeHost } from './node-host'

type PreviewNode = {
  id: string
  type: string
  position: [number, number, number]
  rotation: [number, number, number]
}

type GeometryPreviewProps<Node extends PreviewNode> = {
  node: Node
  buildGeometry: (node: Node) => Object3D
  children?: ReactNode
  geometryPosition?: [number, number, number]
}

/** Shared lifecycle and host registration for procedural equipment previews. */
export function GeometryPreview<Node extends PreviewNode>({
  node,
  buildGeometry,
  children,
  geometryPosition,
}: GeometryPreviewProps<Node>) {
  const rootRef = useRef<Group>(null!)
  const handlers = usePoolNodeHost(node, rootRef)
  const geometry = useMemo(() => buildGeometry(node), [buildGeometry, node])
  useEffect(() => () => disposeObject3D(geometry), [geometry])

  return (
    <group position={node.position} rotation={node.rotation} ref={rootRef} {...handlers}>
      <primitive object={geometry} position={geometryPosition} />
      {children}
    </group>
  )
}
