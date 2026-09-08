# Testing and release

## Local prerequisites

Use Bun 1.3.12, the version pinned in `package.json` and GitHub Actions. Install
the lockfile without updating it:

```bash
bun install --frozen-lockfile
```

## Command reference

| Command | Purpose |
| --- | --- |
| `bun run check-docs` | Validate local Markdown links and code-backed option names |
| `bun run check-architecture` | Reject editor-to-definition imports and runtime cycles |
| `bun run check-types` | Type-check source, tests, and scripts without emitting files |
| `bun test` | Run the complete Bun unit test suite |
| `bun run test:coverage` | Run tests and enforce coverage floors |
| `bun run build` | Produce ESM, declarations, source maps, and assets in `dist/` |
| `bun run check-build-reproducibility` | Build twice and compare output file names and bytes |
| `bun run check-package` | Inspect built exports, assets, declarations, consumer imports, and tarball contents |
| `bun run check-release` | Validate package metadata, version, changelog, and an optional tag |
| `bun run verify` | Run the normal development gate |
| `bun run release:check` | Run every release gate, including audit and coverage |
| `bun run package:release` | Create the tested npm tarball in `release-artifact/` |

Run a single test while iterating:

```bash
bun test src/spillover/design/placement.test.ts
```

## Development gate

```bash
bun run verify
```

The command stops at the first failed phase. It checks documentation,
architecture, TypeScript, unit tests, the production build, and the packed
consumer contract. Run it before opening or updating a pull request.

Pull requests and pushes to `main` run the stricter `release:check` command in
GitHub Actions. The workflow installs from the lockfile and has read-only
repository permissions.

## Coverage policy

```bash
bun run test:coverage
```

Coverage may not fall below 85 percent of loaded lines or 72 percent of loaded
functions. The script clears old coverage output before running and reads the
new LCOV report. A change that loads additional modules can lower the reported
percentage even when existing tests did not change, so inspect the uncovered
behavior rather than updating the threshold to make the gate pass.

Generated files are written to `coverage/` and are not source artifacts.

## Package verification

`check-package` imports `dist/index.js`, confirms the manifest ID, Plugin API
version, and 12 unique node kinds, then type-checks `tests/package-consumer.ts`
against the emitted declarations. It verifies copied assets byte for byte and
inspects `npm pack --dry-run` output.

The packed package must:

- Stay below 5 MB
- Contain no source, tests, scripts, coverage, or nested `node_modules`
- Contain no bundled runtime dependencies
- Include the license, README, changelog, security policy, documentation,
  manifest, JavaScript entry, and declaration entry

## Release preparation

1. Start from the commit intended for the default branch with a clean working
   tree.
2. Choose the next semantic version and update `version` in `package.json`.
3. Move relevant entries from `[Unreleased]` into a dated changelog section with
   the same version.
4. Run `bun install --frozen-lockfile` to prove the lockfile matches.
5. Run `bun run release:check`.
6. Optionally inspect the exact artifact with `bun run package:release` and
   `npm pack --dry-run --json --ignore-scripts`.
7. Merge the reviewed release commit to the default branch.
8. Create and push the matching immutable tag, such as `v0.2.0`.

To validate a proposed tag locally:

```bash
RELEASE_TAG=v0.2.0 bun run release:check
```

The tag without its leading `v` must equal `package.json` version.

## Automated publishing

The release workflow runs for `v*` tags and manual dispatches. Its verification
job uses Bun 1.3.12, confirms that a tag commit is on the repository's default
branch, reruns the complete release gate, creates one tarball, and uploads it as
the `npm-package` artifact for seven days.

Only a `v*` tag starts the publish job. That job downloads the verified artifact,
publishes the exact tarball with npm provenance, and creates a GitHub release.
It uses Node.js 24 and GitHub OIDC. Before the first release, configure:

- An npm trusted publisher for this repository and workflow
- A protected GitHub environment named `npm`
- Permission for the workflow to write release contents and request an ID token

Do not add a long-lived npm token when trusted publishing is available.

## Failure triage

- Documentation failure: fix the reported missing path, fragment, or option name.
- Architecture failure: move the dependency down a layer, use a type-only import,
  or remove the cycle.
- Type failure: run the printed TypeScript command and start at the first error.
- Test or coverage failure: run the named test file, then rerun the full suite.
- Reproducibility failure: look for timestamps, random values, absolute paths, or
  unstable filesystem iteration in build output.
- Package failure: rebuild, inspect `npm pack --dry-run --json --ignore-scripts`,
  and check `package.json` files and exports.
- Audit failure: identify the dependency path with `bun audit`; update or
  override only after checking compatibility.

## Rollback

npm versions are immutable. If a release is broken, deprecate that version,
restore the last good behavior, publish a patch version, and direct consumers to
the patch. Do not reuse or force-move a published version tag.

## Host test gap

The repository covers schemas, pure calculations, geometry contracts, placement,
package contents, and release metadata. A reusable Pascal test application is
still required for browser tests of:

- Catalog insertion and tool cancellation
- Selection, property editing, handles, dragging, and deletion
- Undo and redo
- Save, reload, and legacy-scene migration
- Pool attachment synchronization after pool edits
- WebGL and WebGPU rendering
- Screenshot comparisons for pool, finish, water, waterfall, and equipment variants
- Renderer cleanup after repeated creation and deletion

Do not label those flows as covered until the host fixture runs them in CI.
