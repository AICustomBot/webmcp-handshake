# HSK-01 foundation validation record

Date: 2 September 2026
Branch: `hsk-01-foundation-validation`
Environment: offline sandbox, Node v24.14.1, pnpm 10.34.5, npm 11.11.0, no registry network access.

## Passed offline checks

| Check | Command | Result |
|---|---|---|
| Workspace inventory | `find . -type f \| wc -l` | 42 files present and synced to the repository |
| JSON parse | Python `json.loads` across all `.json` | Pass |
| JSONC parse | comment-stripped parse of `wrangler.jsonc` | Pass |
| YAML parse | `yaml.safe_load` across all `.yml` / `.yaml` | Pass, including the CI workflow |
| License | `head`/`grep` on `LICENSE` | Apache License 2.0 confirmed |
| Credential scan | recursive regex for key/secret/password/token/private-key assignments | No hardcoded credential patterns |
| Static asset shell | headless Chromium capture of `apps/web/public/index.html` | Rendered with no console errors, exceptions, failed resources, or overflow clipping |

## Blocked checks, requires registry network access

| Check | Command | Status |
|---|---|---|
| Dependency install and lockfile | `pnpm install` | Blocked: `ERR_PNPM_META_FETCH_FAIL`, `getaddrinfo ENOTFOUND registry.npmjs.org` |
| Format check | `pnpm format:check` | Blocked, requires Prettier install |
| Typecheck | `pnpm typecheck` | Blocked, requires TypeScript and Worker types |
| Unit tests | `pnpm test` | Blocked, requires Vitest |
| Worker dry-run build | `npx wrangler deploy --dry-run` | Blocked, requires Wrangler |

## Consequence

`pnpm-lock.yaml` is intentionally absent. The CI workflow uses `--frozen-lockfile` and will fail until a lockfile is generated on a networked machine and committed. Completing HSK-01 requires one networked run of install, format, typecheck, test and dry-run, with output attached to the pull request.

## Boundaries respected

No feature implementation, deployment, repository publication, or submission was performed.
