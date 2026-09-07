import { fileURLToPath } from 'node:url'
import { runChecks } from './command-runner'

const projectDirectory = fileURLToPath(new URL('../', import.meta.url))
const bun = process.execPath
const releaseTag = process.env.RELEASE_TAG

await runChecks([
  {
    label: 'release metadata',
    command: [bun, 'run', 'check-release', ...(releaseTag ? ['--tag', releaseTag] : [])],
  },
  { label: 'architecture', command: [bun, 'run', 'check-architecture'] },
  { label: 'types', command: [bun, 'run', 'check-types'] },
  { label: 'coverage', command: [bun, 'run', 'test:coverage'] },
  { label: 'reproducible build', command: [bun, 'run', 'check-build-reproducibility'] },
  { label: 'package', command: [bun, 'run', 'check-package'] },
  { label: 'security audit', command: [bun, 'audit', '--audit-level=high'] },
], projectDirectory)

console.log('\nRelease checks passed')
