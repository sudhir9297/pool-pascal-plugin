import { expect, test } from 'bun:test'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { applyPoolColors, poolPaint, resolvePoolPaintColor } from './paint'
import { generateSceneMaterialId, toSceneMaterialRef, useScene, resolveMaterial, type AnyNode } from '@pascal-app/core'
import { PoolNode } from './schema'

test('editor scene-color references resolve for preview and commit', () => {
  const materials = useScene.getState().materials
  const id = generateSceneMaterialId()
  const material = { preset: 'custom' as const, properties: { ...resolveMaterial(), color: '#ff1234' } }
  const root = new Group()
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
  mesh.name = 'pool-coping'; root.add(mesh)
  const original = mesh.material
  try {
    useScene.setState({ materials: { ...materials, [id]: { id, name: 'Test color', material } } })
    const args = { node: PoolNode.parse({}) as unknown as AnyNode, role: 'border', material: undefined, materialPreset: toSceneMaterialRef(id) }
    expect(resolvePoolPaintColor(undefined, args.materialPreset)).toBe('#ff1234')
    expect(poolPaint.buildPatch(args).metadata).toMatchObject({ poolColors: { border: '#ff1234' } })
    const cleanup = poolPaint.applyPreview({ ...args, root })
    expect(mesh.material.color.getHexString()).toBe('ff1234')
    cleanup!()
    expect(mesh.material).toBe(original)
    expect(resolvePoolPaintColor(undefined, 'scene:missing')).toBeNull()
  } finally { useScene.setState({ materials }); mesh.geometry.dispose(); original.dispose() }
})

test('border painting previews and restores without coloring shell, water or child equipment', () => {
  const root = new Group()
  const border = new Group(); border.name = 'pool-coping'
  const material = new MeshStandardMaterial({ color: '#808080' })
  const geometry = new BoxGeometry()
  const rock = new Mesh(geometry, material)
  border.add(rock); root.add(border)
  const shell = new Mesh(geometry, material); shell.name = 'pool-shell-floor'; root.add(shell)
  const child = new Group(); child.userData.poolPaintOwner = 'child'; root.add(child)
  const equipment = new Mesh(geometry, material); child.add(equipment)
  const undo = applyPoolColors(root, { border: '#ff0000', body: '#00ff00' })
  expect((rock.material as MeshStandardMaterial).color.getHexString()).toBe('ff0000')
  expect(shell.material).toBe(material)
  expect(equipment.material).toBe(material)
  undo()
  expect(rock.material).toBe(material)
  expect(material.color.getHexString()).toBe('808080')
  geometry.dispose(); material.dispose()
})
