import { access, readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  POOL_ENTRY_FEATURES,
  POOL_FINISHES,
  POOL_FLOOR_PROFILES,
  POOL_SHAPES,
  POOL_VISUAL_PRESETS,
  WATER_PRESETS,
} from '../src/core/pool-options'
import { poolPlugin } from '../src/index'

const projectDirectory = fileURLToPath(new URL('../', import.meta.url))
const ignoredDirectories = new Set([
  '.git',
  'coverage',
  'dist',
  'node_modules',
  'release-artifact',
])
const expectedNodeKinds = (poolPlugin.nodes ?? []).map((definition) => definition.kind)

async function markdownFiles(directory: string): Promise<string[]> {
  const result: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) result.push(...await markdownFiles(path))
    else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') result.push(path)
  }
  return result
}

function headingSlugs(markdown: string) {
  const slugs = new Set<string>()
  const counts = new Map<string, number>()
  for (const line of markdown.split('\n')) {
    const match = /^(?: {0,3})#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match?.[1]) continue
    const base = match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/[`*_~]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
    const count = counts.get(base) ?? 0
    counts.set(base, count + 1)
    slugs.add(count === 0 ? base : `${base}-${count}`)
  }
  return slugs
}

function localLinkDestination(rawDestination: string) {
  const destination = rawDestination.trim().replace(/^<|>$/g, '')
  if (
    !destination
    || destination.startsWith('#')
    || destination.startsWith('/')
    || /^[a-z][a-z\d+.-]*:/i.test(destination)
  ) return destination.startsWith('#') ? destination : null
  return destination.split(/\s+['"]/)[0] ?? null
}

const files = await markdownFiles(projectDirectory)
const markdownByPath = new Map<string, string>()
for (const file of files) markdownByPath.set(file, await readFile(file, 'utf8'))

const problems: string[] = []
if (expectedNodeKinds.length === 0) problems.push('poolPlugin does not register any node kinds')
for (const [file, markdown] of markdownByPath) {
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const destination = localLinkDestination(match[1] ?? '')
    if (destination === null) continue
    const [rawPath = '', rawFragment = ''] = destination.split('#', 2)
    let decodedPath: string
    let decodedFragment: string
    try {
      decodedPath = decodeURIComponent(rawPath)
      decodedFragment = decodeURIComponent(rawFragment)
    } catch {
      problems.push(`${relative(projectDirectory, file)} has an invalid encoded link: ${destination}`)
      continue
    }
    const target = rawPath ? resolve(dirname(file), decodedPath) : file
    const projectRelativeTarget = relative(projectDirectory, target)
    if (projectRelativeTarget === '..' || projectRelativeTarget.startsWith(`..${sep}`)) {
      problems.push(`${relative(projectDirectory, file)} links outside the repository: ${destination}`)
      continue
    }
    try {
      if (!(await stat(target)).isFile()) throw new Error('not a file')
      await access(target)
    } catch {
      problems.push(`${relative(projectDirectory, file)} links to a missing file: ${destination}`)
      continue
    }
    if (decodedFragment && extname(target).toLowerCase() === '.md') {
      const targetMarkdown = markdownByPath.get(target) ?? await readFile(target, 'utf8')
      if (!headingSlugs(targetMarkdown).has(decodedFragment.toLowerCase())) {
        problems.push(`${relative(projectDirectory, file)} links to a missing heading: ${destination}`)
      }
    }
  }
}

const nodeReferencePath = resolve(projectDirectory, 'docs/node-reference.md')
const nodeReference = markdownByPath.get(nodeReferencePath) ?? ''
const codeBackedValues = [
  ...expectedNodeKinds,
  ...POOL_SHAPES,
  ...POOL_FLOOR_PROFILES,
  ...POOL_ENTRY_FEATURES,
  ...POOL_VISUAL_PRESETS,
  ...WATER_PRESETS,
  ...POOL_FINISHES,
]
for (const value of new Set(codeBackedValues)) {
  if (!nodeReference.includes(`\`${value}\``)) {
    problems.push(`docs/node-reference.md does not document \`${value}\``)
  }
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem)
  process.exit(1)
}

console.log(`Documentation check passed for ${files.length} Markdown files and ${new Set(codeBackedValues).size} code-backed values`)
