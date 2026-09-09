export function connectionPreviewNode<Node extends { type: string }>(node: Node, diameter: number | null): Node {
  if (diameter === null) return node
  return node.type === 'pool:pump' ? { ...node, diameter } : { ...node, portDiameter: diameter }
}
