import { readdir, readFile } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { relative, resolve } from 'node:path'

type PackageManifest = {
  main: string
  types: string
}

type PackReport = {
  size: number
  bundled: string[]
  files: Array<{ path: string }>
}

const projectDirectory = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as PackageManifest

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function filesBelow(directory: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesBelow(path))
    else files.push(path)
  }
  return files
}

for (const path of [manifest.main, manifest.types]) {
  await readFile(resolve(projectDirectory, path))
}

const entry = await import(`${pathToFileURL(resolve(projectDirectory, manifest.main)).href}?package-check=${Date.now()}`)
invariant(entry.poolPlugin?.id === 'pascal:pool', 'Built package does not export the pool plugin')
invariant(entry.poolPlugin?.apiVersion === 1, 'Built plugin API version changed')
const nodeKinds = entry.poolPlugin?.nodes?.map((definition: { kind: string }) => definition.kind) ?? []
invariant(nodeKinds.length === 12, `Built plugin has ${nodeKinds.length} node kinds instead of 12`)
invariant(new Set(nodeKinds).size === nodeKinds.length, 'Built plugin contains duplicate node kinds')

const consumerTypecheck = Bun.spawn([
  process.execPath,
  'x',
  'tsc',
  '--ignoreConfig',
  '--noEmit',
  '--strict',
  '--skipLibCheck',
  '--target',
  'ES2022',
  '--module',
  'ESNext',
  '--moduleResolution',
  'Bundler',
  'tests/package-consumer.ts',
], {
  cwd: projectDirectory,
  stdout: 'pipe',
  stderr: 'pipe',
})
const [consumerExitCode, consumerStdout, consumerStderr] = await Promise.all([
  consumerTypecheck.exited,
  new Response(consumerTypecheck.stdout).text(),
  new Response(consumerTypecheck.stderr).text(),
])
invariant(
  consumerExitCode === 0,
  `Published declarations fail in a consumer project:\n${consumerStdout}${consumerStderr}`,
)

const assetCopies = [
  ['src/editor/assets', 'dist/assets'],
  ['src/shader/assets/water', 'dist/assets/water'],
] as const
for (const [sourceDirectory, outputDirectory] of assetCopies) {
  const sourceRoot = resolve(projectDirectory, sourceDirectory)
  for (const sourcePath of await filesBelow(sourceRoot)) {
    const assetPath = relative(sourceRoot, sourcePath)
    const outputPath = resolve(projectDirectory, outputDirectory, assetPath)
    invariant(
      isDeepStrictEqual(await readFile(sourcePath), await readFile(outputPath)),
      `Built asset differs from source: ${sourceDirectory}/${assetPath}`,
    )
  }
}

const pack = Bun.spawn(['npm', 'pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: projectDirectory,
  stdout: 'pipe',
  stderr: 'pipe',
})
const [exitCode, stdout, stderr] = await Promise.all([
  pack.exited,
  new Response(pack.stdout).text(),
  new Response(pack.stderr).text(),
])
invariant(exitCode === 0, `npm pack failed: ${stderr.trim()}`)
const reports = JSON.parse(stdout) as PackReport[]
const report = reports[0]
invariant(report, 'npm pack returned no package report')
invariant(report.size < 5_000_000, `Packed package is ${(report.size / 1_000_000).toFixed(2)} MB; limit is 5 MB`)
invariant(report.bundled.length === 0, 'Runtime dependencies were bundled into the package')

const publishedPaths = report.files.map((file) => file.path)
const forbidden = publishedPaths.filter((path) => (
  path.startsWith('src/')
  || path.startsWith('scripts/')
  || path.startsWith('coverage/')
  || /(?:^|\/)node_modules\//.test(path)
  || /\.test\.[cm]?[jt]sx?$/.test(path)
))
invariant(forbidden.length === 0, `Package contains forbidden files: ${forbidden.join(', ')}`)
for (const required of [
  'LICENSE',
  'README.md',
  'CONTRIBUTING.md',
  'CONTEXT.md',
  'CHANGELOG.md',
  'SECURITY.md',
  'docs/README.md',
  'docs/architecture.md',
  'docs/node-reference.md',
  'docs/public-api.md',
  'docs/testing-and-release.md',
  'package.json',
  'dist/index.js',
  'dist/index.d.ts',
]) {
  invariant(publishedPaths.includes(required), `Package is missing ${required}`)
}

console.log(`Package artifact passed: ${nodeKinds.length} node kinds, ${publishedPaths.length} files, ${(report.size / 1_000_000).toFixed(2)} MB`)
