import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const projectDirectory = fileURLToPath(new URL('../', import.meta.url))
const outputDirectory = fileURLToPath(new URL('../dist/', import.meta.url))

await rm(outputDirectory, { recursive: true, force: true })
await mkdir(outputDirectory, { recursive: true })

const bundle = await Bun.build({
  entrypoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
  outdir: outputDirectory,
  target: 'browser',
  format: 'esm',
  splitting: true,
  sourcemap: 'external',
  packages: 'external',
})

if (!bundle.success) {
  for (const message of bundle.logs) console.error(message)
  process.exitCode = 1
  throw new Error('JavaScript bundle failed')
}

const workerBundle = await Bun.build({
  entrypoints: [fileURLToPath(new URL('../src/editor/routing-worker.ts', import.meta.url))],
  outdir: outputDirectory,
  target: 'browser',
  format: 'esm',
  naming: 'routing-worker.js',
})
if (!workerBundle.success) throw new Error('Routing worker bundle failed')

for (const output of bundle.outputs) {
  if (!output.path.endsWith('.js')) continue
  const source = await readFile(output.path, 'utf8')
  const directive = /^\s*["']use client["'];?\s*$/gm
  if (!directive.test(source)) continue
  await writeFile(output.path, `"use client";\n${source.replace(directive, '')}`)
}

const declarations = Bun.spawn([
  process.execPath,
  'x',
  'tsc',
  '--project',
  'tsconfig.build.json',
], {
  cwd: projectDirectory,
  stdout: 'inherit',
  stderr: 'inherit',
})
if (await declarations.exited !== 0) throw new Error('Type declaration build failed')

await cp(
  fileURLToPath(new URL('../src/editor/assets/', import.meta.url)),
  fileURLToPath(new URL('../dist/assets/', import.meta.url)),
  { recursive: true },
)
await cp(
  fileURLToPath(new URL('../src/shader/assets/water/', import.meta.url)),
  fileURLToPath(new URL('../dist/assets/water/', import.meta.url)),
  { recursive: true },
)
