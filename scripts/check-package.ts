import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { relative, resolve } from 'node:path'

type PackageManifest = {
  main: string
  types: string
  exports: { '.': { types: string; default: string } }
  scripts: Record<string, string>
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
  invariant(path === './src/index.ts', 'Package must resolve directly to source')
  await readFile(resolve(projectDirectory, path))
}
invariant(manifest.exports['.'].types === manifest.types && manifest.exports['.'].default === manifest.main, 'Exports must resolve to source')
for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepack']) {
  invariant(!manifest.scripts[hook], `Package must not run ${hook}`)
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
  '--noUncheckedIndexedAccess',
  '--skipLibCheck',
  '--target',
  'ES2022',
  '--module',
  'ESNext',
  '--moduleResolution',
  'Bundler',
  '--jsx',
  'react-jsx',
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
  `Published source fails in a consumer project:\n${consumerStdout}${consumerStderr}`,
)

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
for (const file of await filesBelow(resolve(projectDirectory, 'src'))) {
  if (/\.test\.[cm]?[jt]sx?$/.test(file)) continue
  invariant(publishedPaths.includes(relative(projectDirectory, file)), `Package is missing source or asset: ${file}`)
}
const forbidden = publishedPaths.filter((path) => (
  path.startsWith('dist/')
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
  'src/index.ts',
  'src/editor/routing-worker.ts',
]) {
  invariant(publishedPaths.includes(required), `Package is missing ${required}`)
}

console.log(`Package artifact passed: ${nodeKinds.length} node kinds, ${publishedPaths.length} files, ${(report.size / 1_000_000).toFixed(2)} MB`)
