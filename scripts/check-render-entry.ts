/**
 * Render-entry boundary gate: bundles `./render` (every static and lazy import,
 * workers and peer dependencies included) and fails if anything in the graph
 * resolves to `@pascal-app/editor` or `next`. A self-test first bundles the root
 * entry and expects the gate to catch its editor imports, so a blind check fails.
 *
 *   bun run check:render              # self-test, then check ./render
 *   bun run check:render src/foo.ts   # report editor/next reach from any module
 */
import { realpathSync } from 'node:fs'
import { relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BunPlugin } from 'bun'

const FORBIDDEN_SPECIFIER = /^(?:@pascal-app\/editor|next)(?:\/|$)/
const FORBIDDEN_PATH = /\/node_modules\/(?:@pascal-app\/editor|next)\//
const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = await Bun.file(`${root}package.json`).json()

type Hit = { specifier: string; importer: string }

async function forbiddenImports(entry: string): Promise<{ hits: Hit[]; modules: number }> {
  const hits: Hit[] = []
  const seen = new Set<string>()
  const display = (path: string) => relative(root, path) || path
  const gate: BunPlugin = {
    name: 'render-entry-gate',
    setup(build) {
      build.onResolve({ filter: FORBIDDEN_SPECIFIER }, (args) => {
        hits.push({ specifier: args.path, importer: display(args.importer) })
        return { path: args.path, external: true }
      })
      // Catch resolutions that land inside the editor or next through a path
      // the specifier filter cannot see (relative imports from within them).
      build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, (args) => {
        seen.add(args.path)
        let real = args.path
        try {
          real = realpathSync(args.path)
        } catch {}
        if (FORBIDDEN_PATH.test(real.replaceAll('\\', '/'))) {
          hits.push({ specifier: display(real), importer: '(resolved path)' })
        }
        return undefined
      })
    },
  }
  const result = await Bun.build({
    entrypoints: [`${root}${entry.replace(/^\.\//, '')}`],
    target: 'browser',
    format: 'esm',
    splitting: true,
    loader: { '.webp': 'file', '.png': 'file', '.svg': 'file', '.txt': 'file' },
    plugins: [gate],
    throw: false,
  })
  if (!result.success) {
    for (const log of result.logs) console.error(log)
    throw new Error(`bundling ${entry} failed`)
  }
  return { hits, modules: seen.size }
}

function print(label: string, hits: Hit[]) {
  for (const hit of hits) console.error(`  ${hit.importer} -> ${hit.specifier}`)
  if (hits.length === 0) console.log(`${label}: no editor or next imports`)
}

const probe = process.argv[2]
if (probe) {
  const { hits, modules } = await forbiddenImports(probe)
  console.log(`${probe}: ${modules} modules, ${hits.length} forbidden import(s)`)
  print(probe, hits)
  process.exit(0)
}

const rootEntry = pkg.exports['.'].default as string
const renderEntry = pkg.exports['./render'].default as string

const probeResult = await forbiddenImports(rootEntry)
if (!probeResult.hits.some((hit) => hit.specifier.startsWith('@pascal-app/editor'))) {
  console.error(`Self-test failed: the root entry (${rootEntry}) should reach @pascal-app/editor.`)
  process.exit(1)
}

const renderResult = await forbiddenImports(renderEntry)
if (renderResult.hits.length > 0) {
  console.error(`./render (${renderEntry}) reaches editor-only modules:`)
  print(renderEntry, renderResult.hits)
  process.exit(1)
}

console.log(
  `./render (${renderEntry}, ${renderResult.modules} modules) is editor-free; the self-test caught ${probeResult.hits.length} editor/next import(s) from the root entry.`,
)
