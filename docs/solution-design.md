# Solution Design: Centralized Node.js Approved Dependencies

**Repository:** nodejs-approved-deps  
**Status:** Proposed  
**Audience:** Application teams, Platform Engineering, DevSecOps  
**Initial runtimes:** Node.js 24 and Node.js 26  
**Package manager:** npm  
**Primary use case:** Next.js applications

## 1. Executive Summary

Central Git repository `nodejs-approved-deps` manages approved npm dependency versions and security policy for Node.js applications.

Each supported Node.js major version has a protected branch (`node-24`, `node-26`) containing an approved manifest, policy, generator/validator scripts, and CI.

Consumer apps merge approved versions into their **existing** `package.json` (no `package.template.json`). Direct versions live in `approved-deps.json`; the full tree is pinned via committed `package-lock.json` and `npm ci`.

## 2. Goals

- Auditable, centrally reviewed approved versions
- Policy separated by Node.js major
- Automatic merge of approved deps into consumer `package.json`
- Exact versions (no floating ranges)
- Reproducible installs (`npm ci`)
- Vulnerability scanning on resolved tree
- Review + CI before policy changes
- Repeatable Next.js onboarding

## 3. Non-Goals

- Guarantee zero vulnerabilities
- Auto-upgrade all consumers on every policy change
- Replace lockfile with manifest
- Centralize app scripts/settings
- Treat manifest listing as permanent security approval

## 4. Architecture

```
nodejs-approved-deps (central)
    ├── branch node-24 ── approved-deps.json, policy.json, scripts
    └── branch node-26 ── same layout
              │
              ▼
    Consumer app: generate/update package.json → lockfile review → npm ci → scan → build
```

**Principles:** `approved-deps.json` is SOT for direct versions; one branch per runtime; generator updates consumer `package.json` in place; pin central repo by commit SHA in production CI.

## 5. Repository Layout (each runtime branch)

```
nodejs-approved-deps/
├── README.md
├── package.json              # tooling only, not consumer allowlist
├── approved-deps.json
├── policy.json
├── scripts/
│   ├── generate-package.mjs
│   └── validate-policy.mjs
└── .github/workflows/validate.yml
```

## 6. Manifest (`approved-deps.json`)

- `schemaVersion`, `runtime`, `packageManager`
- Exact semver in `dependencies` / `devDependencies` (no `^`, `~`, `*`, git URLs)
- `runtime` must match branch and `policy.json`

## 7. Policy (`policy.json`)

- `requireExactVersions`, `failOnHighOrCriticalVulnerabilities`, `requireLockfile`, `requireSecurityReview`
- `dependencyOwnershipMode`: `strict` (recommended) or `mixed`
- Policy configures enforcement; scan evidence lives in CI artifacts

## 8. Generator

Runs in **consumer** repo:

```bash
node scripts/generate-package.mjs \
  --manifest /path/approved-deps.json \
  --policy /path/policy.json \
  --package ./package.json
```

**Behavior:** validate manifest/policy; merge approved versions into `dependencies` / `devDependencies`; set `engines.node` from runtime; preserve name, scripts, and other fields; **strict** fails on extra governed deps; **mixed** allows project-specific packages; idempotent output.

**CI:** prefer `--check` (fail if committed `package.json` would change).

## 9. Consumer Integration

1. Fetch central repo at **approved commit SHA** (not floating branch tip in prod).
2. Run generator (or `--check` in CI).
3. Update `package-lock.json` in a reviewed PR when versions change.
4. CI: `npm ci`, scan, build on correct Node major.

## 10. Branch & Governance

- Protected `node-24` / `node-26`; PRs + reviewers for manifest changes
- CI must pass; retain scan results; consumers adopt via reviewed SHA bumps

## 11. Security

Scan direct + transitive; fail High/Critical without time-boxed exception; pin Actions and central fetch to SHAs; periodic re-scan; SBOM if required.

## 12. Failure Handling

Fail fast on: invalid schema, runtime mismatch, non-exact versions, strict-mode extras, lockfile drift, unpinned central revision in prod, scan policy violations.

## 13. Acceptance Criteria

- Branches `node-24`, `node-26` with manifest + policy + scripts + central CI
- Generator preserves consumer metadata; exact-version validation; idempotent
- Ownership mode documented in policy
- Consumer CI: pinned SHA, check/generate, `npm ci`, scan, build
- Docs for add/update package, runtime switch, vulnerabilities

## 14. Open Decisions

Allowlist vs mixed extras; Git fetch vs internal CLI; registry; scanner choice; exception owners/SLA; scope (overrides, peers, optional); update cadence; confirmed Node/Next support matrix.

## 15. Recommendation

Start with Git branches + manifest + policy + deterministic generator/validator; app-owned `package.json`; committed lockfile; immutable central SHA in CI.
