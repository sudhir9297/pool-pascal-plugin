import { fileURLToPath } from 'node:url'
import { runChecks } from './command-runner'

const projectDirectory = fileURLToPath(new URL('../', import.meta.url))
const bun = process.execPath

await runChecks([
  { label: 'architecture', command: [bun, 'run', 'check-architecture'] },
  { label: 'types', command: [bun, 'run', 'check-types'] },
  { label: 'tests', command: [bun, 'test'] },
  { label: 'build', command: [bun, 'run', 'build'] },
  { label: 'package', command: [bun, 'run', 'check-package'] },
], projectDirectory)

console.log('\nVerification passed')
