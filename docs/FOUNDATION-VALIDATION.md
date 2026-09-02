# HSK-01 foundation validation record

Date: 2 September 2026
Branch: `hsk-01-foundation-validation`
Pull request: #1

## Environments

| Environment                                     | Purpose                                     | Network            |
| ----------------------------------------------- | ------------------------------------------- | ------------------ |
| Architect sandbox (Node v24.14.1, pnpm 10.34.5) | Static and structural validation, authoring | No registry access |
| Owner workstation (macOS, Wrangler 4.128.0)     | Install, typecheck, test, Worker dry-run    | Full               |

## Passed in the architect sandbox

| Check               | Command                                                               | Result                                                                              |
| ------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Workspace inventory | `find . -type f \| wc -l`                                             | 42 files present and synced to the repository                                       |
| JSON parse          | Python `json.loads` across all `.json`                                | Pass                                                                                |
| JSONC parse         | comment-stripped parse of `wrangler.jsonc`                            | Pass                                                                                |
| YAML parse          | `yaml.safe_load` across all `.yml` / `.yaml`                          | Pass, including the CI workflow                                                     |
| License             | `head`/`grep` on `LICENSE`                                            | Apache License 2.0 confirmed                                                        |
| Credential scan     | recursive regex for key/secret/password/token/private-key assignments | No hardcoded credential patterns                                                    |
| Static asset shell  | headless Chromium capture of `apps/web/public/index.html`             | Rendered with no console errors, exceptions, failed resources, or overflow clipping |

GitHub Advanced Security secret scanning is not enabled on this repository, so a local regex scan was used instead.

## Toolchain corrections found by the first networked run

The scaffold was authored without registry access, so three version assumptions proved wrong. Each is corrected on this branch.

| Finding                                      | Evidence                                                                                                         | Correction                                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Dependency ranges were hand-pinned and stale | `ERR_PNPM_NO_MATCHING_VERSION` for `@cloudflare/workers-types@^4.20260831.0`; the package is now on the 5.x line | Resolve versions from the registry and commit the resulting exact versions plus `pnpm-lock.yaml` |
| `baseUrl` removed from TypeScript            | `TS5102`, plus `TS5090` on both non-relative path mappings                                                       | Remove `baseUrl` and make `paths` entries relative                                               |
| Durable Object base class is module-scoped   | `TS2689 Cannot extend an interface 'DurableObject'` and `TS2741` on the missing brand                            | Import the class from `cloudflare:workers`                                                       |

## Passed on the owner workstation

| Check                | Command                         | Result                                                                                      |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------------------- |
| Format               | `pnpm format:check`             | Pass, all matched files use Prettier style                                                  |
| Worker dry-run build | `npx wrangler deploy --dry-run` | Pass, 0.99 KiB upload; bindings resolved for `DESIGN_SESSION` (Durable Object) and `ASSETS` |

## Passed in the full gated run (2 September 2026)

| Check                   | Command                                 | Result                                                                                      |
| ----------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| Frozen-lockfile install | `pnpm install --frozen-lockfile`        | Pass against the committed `pnpm-lock.yaml` (pnpm 10.15.0, Node v22.22.3)                   |
| Full check              | `pnpm check`                            | Pass: format clean, `tsc --noEmit` clean, Vitest 2/2 tests passed in 113ms                  |
| Worker dry-run build    | `CI=true npx wrangler deploy --dry-run` | Pass, 1.04 KiB upload; bindings resolved for `DESIGN_SESSION` (Durable Object) and `ASSETS` |
| Hygiene                 | `git ls-tree HEAD`, `git status`        | Stray `.tsconfig.json.swp` removed from the tree; `*.swp` added to `.gitignore`             |

## Open before HSK-01 can close

- Re-run `pnpm check` after the Durable Object correction and record typecheck and unit-test output. (Done above.)
- Commit `pnpm-lock.yaml` with the resolved versions so CI `--frozen-lockfile` can pass. (Done on this branch.)
- Confirm the first CI run is green, then mark the pull request ready for review. (Pending push and CI.)

## Operational note

Wrangler offered to update local agent skill files during the dry-run. Any files that tool writes must be reviewed before they enter the repository; `AGENTS.md` is the governed engineering constitution and must not be modified by tooling.

## Boundaries respected

No feature implementation, deployment, repository publication, or submission was performed.
