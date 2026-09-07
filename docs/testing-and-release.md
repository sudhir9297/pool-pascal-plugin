# Testing and release

## Local checks

Run the normal development gate with:

```bash
bun run verify
```

Before creating a version tag, run:

```bash
bun run release:check
```

The release gate checks metadata, dependency direction, TypeScript, unit tests, coverage, reproducible production output, packed package contents, runtime and type imports from a consumer project, copied assets, package size, and high-severity dependency advisories.

Coverage may not fall below 85% of loaded lines or 72% of loaded functions. The current baseline is 87.70% of lines and 77.09% of functions. The thresholds catch a real regression while leaving room for small changes in which modules the tests load.

## Publishing

1. Update `version` in `package.json`.
2. Add the same version to `CHANGELOG.md`.
3. Run `bun run release:check` from a clean checkout.
4. Merge the reviewed change to `main`.
5. Create and push the matching tag, such as `v0.2.0`.

The release workflow verifies the tag against `package.json`, confirms the tagged commit belongs to the default branch, reruns every gate, and uploads the tested tarball. A separate job publishes that exact tarball with npm provenance and creates a GitHub release. Configure the GitHub `npm` environment and npm trusted publishing before pushing the first release tag.

## Rollback

npm packages are immutable. If a release is broken, deprecate that version, restore the last good source, publish a patch, and move consumers to the patch. Never reuse or force-move a published version tag.

## Tests still requiring the Pascal host

This repository now covers pure geometry, schemas, placement, package contents, and release metadata. Host-level editor behavior still needs a reusable Pascal test application. When that fixture is available, add browser tests for catalog insertion, selection, dragging, undo and redo, save and reload, WebGL and WebGPU rendering, and screenshot comparisons for every pool and waterfall variant.
