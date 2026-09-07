import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { relative, resolve } from 'node:path'
import { runChecks } from './command-runner'

const projectDirectory = fileURLToPath(new URL('../', import.meta.url))
const outputDirectory = resolve(projectDirectory, 'dist')
const bun = process.execPath

async function filesBelow(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesBelow(path))
    else files.push(path)
  }
  return files.sort()
}

async function snapshot() {
  const result = new Map<string, string>()
  for (const path of await filesBelow(outputDirectory)) {
    result.set(
      relative(outputDirectory, path),
      createHash('sha256').update(await readFile(path)).digest('hex'),
    )
  }
  return result
}

await runChecks([{ label: 'first build', command: [bun, 'run', 'build'] }], projectDirectory)
const first = await snapshot()
await runChecks([{ label: 'second build', command: [bun, 'run', 'build'] }], projectDirectory)
const second = await snapshot()

const paths = new Set([...first.keys(), ...second.keys()])
const changed = [...paths].filter((path) => first.get(path) !== second.get(path))
if (changed.length > 0) {
  throw new Error(`Build output is not reproducible: ${changed.slice(0, 10).join(', ')}`)
}

console.log(`Reproducible build passed for ${first.size} files`)
