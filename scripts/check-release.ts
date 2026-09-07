import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

type PackageManifest = {
  name?: string
  version?: string
  private?: boolean
  license?: string
  repository?: unknown
  files?: string[]
  main?: string
  types?: string
  packageManager?: string
  publishConfig?: { access?: string; provenance?: boolean }
}

const projectDirectory = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as PackageManifest
const changelog = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8')

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

invariant(manifest.name === '@pascal-app/plugin-pool', 'Unexpected package name')
invariant(typeof manifest.version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version), 'Package version is not valid semver')
invariant(manifest.private !== true, 'Package is marked private')
invariant(manifest.license === 'MIT', 'Package license must be MIT')
invariant(manifest.repository, 'Package repository metadata is missing')
invariant(manifest.main === './dist/index.js', 'Package main entry must point to dist/index.js')
invariant(manifest.types === './dist/index.d.ts', 'Package types entry must point to dist/index.d.ts')
invariant(manifest.files?.includes('dist'), 'Published files must include dist')
invariant(manifest.packageManager === 'bun@1.3.12', 'packageManager must pin the CI Bun version')
invariant(manifest.publishConfig?.access === 'public', 'Scoped package must publish with public access')
invariant(manifest.publishConfig?.provenance === true, 'npm provenance must be enabled')
invariant(changelog.includes(`## [${manifest.version}]`), `CHANGELOG.md has no ${manifest.version} release entry`)

const tagFlag = process.argv.findIndex((argument) => argument === '--tag')
const suppliedTag = tagFlag >= 0 ? process.argv[tagFlag + 1] : process.env.RELEASE_TAG
if (suppliedTag) {
  const tagVersion = suppliedTag.replace(/^refs\/tags\//, '').replace(/^v/, '')
  invariant(tagVersion === manifest.version, `Release tag ${suppliedTag} does not match package version ${manifest.version}`)
}

console.log(`Release metadata passed for ${manifest.name}@${manifest.version}`)
