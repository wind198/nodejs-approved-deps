# nodejs-approved-deps

Central **approved dependency versions** and policy for Node.js apps (Next.js-first). One Git branch per Node major: `node-24`, `node-26`.

Illustrative versions in `approved-deps.json` are **not** security approvals—replace after org review and scanning.

## Layout

| File | Role |
|------|------|
| `approved-deps.json` | Exact direct `dependencies` / `devDependencies` |
| `policy.json` | Enforcement settings (`dependencyOwnershipMode`: `strict` \| `mixed`) |
| `scripts/generate-package.mjs` | Merge manifest into a consumer `package.json` |
| `scripts/validate-policy.mjs` | Validate manifest + policy on this branch |

Design: [docs/solution-design.md](docs/solution-design.md)

## Branches

- **`node-24`** — policy for Node.js 24.x (`engines.node`: `>=24 <25`)
- **`node-26`** — duplicate layout; set `runtime` to `node-26` in manifest and policy

Protect branches; merge manifest changes via PR with CI green.

## Consumer usage

Pin an **approved commit SHA** (not a moving branch tip in production CI).

```bash
git clone https://github.com/YOUR_ORG/nodejs-approved-deps.git /tmp/nodejs-approved-deps
git -C /tmp/nodejs-approved-deps checkout <APPROVED_SHA>

node /tmp/nodejs-approved-deps/scripts/generate-package.mjs \
  --manifest /tmp/nodejs-approved-deps/approved-deps.json \
  --policy /tmp/nodejs-approved-deps/policy.json \
  --package ./package.json
```

Update lockfile in a reviewed change, then:

```bash
npm ci
npm audit   # or org scanner
npm run build
```

CI check mode (no writes):

```bash
node .../generate-package.mjs --manifest ... --policy ... --package ./package.json --check
```

## Local development (this repo)

```bash
npm run validate
npm run test:generator
```

## Changing approved versions

1. Open PR against the runtime branch.
2. Edit `approved-deps.json` (exact semver only).
3. CI runs `validate` + generator fixtures.
4. After merge, consumers bump pinned SHA and refresh `package.json` / lockfile in their repos.
