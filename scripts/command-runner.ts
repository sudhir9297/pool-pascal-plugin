export type Check = {
  label: string
  command: string[]
}

export async function runChecks(checks: readonly Check[], cwd: string) {
  for (const check of checks) {
    console.log(`\n[${check.label}] ${check.command.join(' ')}`)
    const child = Bun.spawn(check.command, {
      cwd,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    })
    const exitCode = await child.exited
    if (exitCode !== 0) {
      throw new Error(`${check.label} failed with exit code ${exitCode}`)
    }
  }
}
