import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import ts from 'typescript'

const projectDirectory = resolve(import.meta.dir, '..')
const sourceDirectory = resolve(projectDirectory, 'src')

async function sourceFiles(directory: string): Promise<string[]> {
  const result: string[] = []
  for (const entry of await readdir(directory)) {
    const path = resolve(directory, entry)
    const metadata = await stat(path)
    if (metadata.isDirectory()) result.push(...await sourceFiles(path))
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) result.push(path)
  }
  return result
}

function runtimeImportSpecifier(node: ts.Node): string | null {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    const clause = node.importClause
    const namedImportsAreTypes = !clause?.name
      && clause?.namedBindings
      && ts.isNamedImports(clause.namedBindings)
      && clause.namedBindings.elements.every((element) => element.isTypeOnly)
    return clause?.isTypeOnly || namedImportsAreTypes ? null : node.moduleSpecifier.text
  }
  if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
    return node.moduleSpecifier.text
  }
  if (
    ts.isCallExpression(node)
    && node.expression.kind === ts.SyntaxKind.ImportKeyword
    && node.arguments[0]
    && ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0].text
  }
  return null
}

function resolveLocalImport(importer: string, specifier: string, knownFiles: Set<string>) {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(importer), specifier)
  return [
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, 'index.ts'),
    resolve(base, 'index.tsx'),
  ].find((candidate) => knownFiles.has(candidate)) ?? null
}

const files = await sourceFiles(sourceDirectory)
const knownFiles = new Set(files)
const imports = new Map<string, Set<string>>()
const violations: string[] = []

for (const file of files) {
  const source = ts.createSourceFile(
    file,
    await readFile(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const dependencies = new Set<string>()
  const inspect = (node: ts.Node) => {
    const specifier = runtimeImportSpecifier(node)
    const dependency = specifier ? resolveLocalImport(file, specifier, knownFiles) : null
    if (dependency) {
      dependencies.add(dependency)
      const fileName = relative(sourceDirectory, file)
      const dependencyName = relative(sourceDirectory, dependency)
      const editorModule = fileName.startsWith('editor/') || fileName.includes('/editor/')
      if (editorModule && dependencyName.endsWith('/core/definition.ts')) {
        violations.push(`${fileName} imports ${dependencyName}; editor modules must use schemas and defaults directly`)
      }
    }
    ts.forEachChild(node, inspect)
  }
  inspect(source)
  imports.set(file, dependencies)
}

const visited = new Set<string>()
const active = new Set<string>()
const path: string[] = []

function visit(file: string) {
  visited.add(file)
  active.add(file)
  path.push(file)
  for (const dependency of imports.get(file) ?? []) {
    if (!visited.has(dependency)) visit(dependency)
    else if (active.has(dependency)) {
      const cycleStart = path.indexOf(dependency)
      const cycle = [...path.slice(cycleStart), dependency]
        .map((entry) => relative(sourceDirectory, entry))
        .join(' -> ')
      violations.push(`runtime import cycle: ${cycle}`)
    }
  }
  path.pop()
  active.delete(file)
}

for (const file of files) if (!visited.has(file)) visit(file)

if (violations.length > 0) {
  for (const violation of violations) console.error(violation)
  process.exit(1)
}

console.log(`Architecture check passed for ${files.length} source modules`)
