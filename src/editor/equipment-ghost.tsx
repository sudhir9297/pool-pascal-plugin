'use client'

import { useEffect, useMemo } from 'react'
import { Mesh, type Object3D } from 'three'
import { disposeObject3D } from './dispose-object'

export function EquipmentGhost<Node>({ node, buildGeometry }: {
  node: Node
  buildGeometry: (node: Node) => Object3D
}) {
  const geometry = useMemo(() => {
    const root = buildGeometry(node)
    root.traverse((object) => {
      object.raycast = () => undefined
      if (!(object instanceof Mesh)) return
      object.castShadow = false
      object.receiveShadow = false
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.transparent = true
        material.opacity = 0.45
        material.depthWrite = false
      }
    })
    return root
  }, [node, buildGeometry])
  useEffect(() => () => disposeObject3D(geometry), [geometry])
  return <primitive object={geometry} />
}
