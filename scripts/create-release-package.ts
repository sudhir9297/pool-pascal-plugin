import { mkdir, readdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

type PackReport = { filename: string }

const projectDirectory = fileURLToPath(new URL('../', import.meta.url))
const outputDirectory = resolve(projectDirectory, 'release-artifact')

await rm(outputDirectory, { recursive: true, force: true })
await mkdir(outputDirectory, { recursive: true })

const pack = Bun.spawn([
  'npm',
  'pack',
  '--json',
  '--ignore-scripts',
  `--pack-destination=${outputDirectory}`,
], {
  cwd: projectDirectory,
  stdout: 'pipe',
  stderr: 'pipe',
})
const [exitCode, stdout, stderr] = await Promise.all([
  pack.exited,
  new Response(pack.stdout).text(),
  new Response(pack.stderr).text(),
])
if (exitCode !== 0) throw new Error(`npm pack failed: ${stderr.trim()}`)

const report = (JSON.parse(stdout) as PackReport[])[0]
if (!report) throw new Error('npm pack returned no package report')
const files = await readdir(outputDirectory)
if (files.length !== 1 || files[0] !== report.filename) {
  throw new Error(`Expected one release package named ${report.filename}; found ${files.join(', ')}`)
}

console.log(`Created release-artifact/${report.filename}`)
