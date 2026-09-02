# HSK-07 release evidence

## Candidate

- Baseline commit: `ee6b72d0b238600bd4f6cf5e7cea43b11d70ad31`
- Runtime: Cloudflare Workers, Static Assets, and Durable Objects
- Data: synthetic only
- License: Apache-2.0

## Automated gates

The release branch runs a frozen install, formatting check, TypeScript validation, unit/integration tests, and Wrangler dry-run. CI uses pinned pnpm, repository-read-only permissions, checkout credential isolation, concurrency cancellation, and a ten-minute timeout.

## Health and boundary verification

`GET /healthz` returns only the service name and contract version. Non-GET methods are rejected. Request-limit tests include an actual oversized `ReadableStream` without a `Content-Length` header.

## Evidence still requiring a deployed candidate or supported browser

- Live Worker health check and rollback exercise
- Chrome WebMCP tool-registration smoke test
- ChatGPT in-app-browser golden journey
- Keyboard, focus, zoom, mobile, and screen-reader smoke evidence
- Public URL, public repository, video, and Devpost fields

## Release boundary

No Cloudflare deployment, repository visibility change, public video, or Devpost submission is authorized by this work. Those actions require Ehab's review of the exact candidate commit and release artifacts.
