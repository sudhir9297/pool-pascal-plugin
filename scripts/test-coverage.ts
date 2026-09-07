import { readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const projectDirectory = fileURLToPath(new URL('../', import.meta.url))
const coverageDirectory = fileURLToPath(new URL('../coverage/', import.meta.url))
const reportPath = fileURLToPath(new URL('../coverage/lcov.info', import.meta.url))

await rm(coverageDirectory, { recursive: true, force: true })
const test = Bun.spawn([
  process.execPath,
  'test',
  '--coverage',
  '--coverage-reporter=lcov',
  '--coverage-dir=coverage',
], {
  cwd: projectDirectory,
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})
if (await test.exited !== 0) throw new Error('Coverage test run failed')

const report = await readFile(reportPath, 'utf8')
const totals = { linesFound: 0, linesHit: 0, functionsFound: 0, functionsHit: 0 }
for (const line of report.split('\n')) {
  const [key, rawValue] = line.split(':', 2)
  const value = Number(rawValue)
  if (!Number.isFinite(value)) continue
  if (key === 'LF') totals.linesFound += value
  else if (key === 'LH') totals.linesHit += value
  else if (key === 'FNF') totals.functionsFound += value
  else if (key === 'FNH') totals.functionsHit += value
}

const lineRate = totals.linesFound === 0 ? 0 : totals.linesHit / totals.linesFound
const functionRate = totals.functionsFound === 0 ? 0 : totals.functionsHit / totals.functionsFound
const minimumLineRate = 0.85
const minimumFunctionRate = 0.72
const percent = (value: number) => `${(value * 100).toFixed(2)}%`

console.log(`Coverage: ${percent(lineRate)} lines, ${percent(functionRate)} functions`)
if (lineRate < minimumLineRate || functionRate < minimumFunctionRate) {
  throw new Error(
    `Coverage must stay above ${percent(minimumLineRate)} lines and ${percent(minimumFunctionRate)} functions`,
  )
}
