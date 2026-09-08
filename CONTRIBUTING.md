# Contributing

## Prerequisites

- Bun 1.3.12
- Git
- A checkout of this repository

Install the locked dependencies:

```bash
bun install --frozen-lockfile
```

## Make a change

1. Create a focused branch from the latest default branch.
2. Put persisted data and defaults in a feature's `core/` directory.
3. Put deterministic calculations in `design/` and host adapters in `editor/`.
4. Add or update tests beside the implementation.
5. Update user-facing documentation and `CHANGELOG.md` when behavior changes.
6. Run `bun run verify` before opening a pull request.

Do not edit generated files in `dist/`, `coverage/`, or `release-artifact/`.

## Module rules

Each contributed node is a vertical slice. Its schema owns defaults and saved
data. Its definition registers the node and lazy client modules. Geometry and
placement calculations should not read global editor state. Editor modules may
use schemas and design helpers, but they must not import a node definition.

The root `src/index.ts` is the package contract. Export a symbol there only when
external consumers should depend on it. Keep editor-only helpers internal.

Read [Architecture](docs/architecture.md) before moving modules or adding a new
node kind.

## Test expectations

- Schema changes need default, bounds, and migration tests.
- Geometry changes need stable structural assertions and disposal coverage when
  they allocate Three.js resources.
- Placement changes need rotated, translated, missing-parent, and boundary cases.
- Public export changes need a consumer type-check in `tests/package-consumer.ts`.
- Asset changes need the production package check.
- Documentation changes must pass `bun run check-docs`.

Use `bun test path/to/file.test.ts` while iterating, then run the full gate.
Coverage floors and every release check are documented in
[Testing and release](docs/testing-and-release.md).

## Pull requests

Keep each pull request limited to one coherent change. Describe saved-data or
public-API compatibility, list the checks you ran, and include screenshots for
visible editor or renderer changes.

Do not publish packages from a development branch. Releases are produced by the
tag workflow after the version and changelog update have been reviewed.
