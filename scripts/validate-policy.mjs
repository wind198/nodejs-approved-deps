import fs from "node:fs";

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const RUNTIMES = new Set(["node-24", "node-26"]);
const OWNERSHIP_MODES = new Set(["strict", "mixed"]);

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function validateManifest(manifest) {
  if (manifest.schemaVersion !== 1) {
    fail(`approved-deps.json: unsupported schemaVersion ${manifest.schemaVersion}`);
  }
  if (!RUNTIMES.has(manifest.runtime)) {
    fail(`approved-deps.json: unsupported runtime ${manifest.runtime}`);
  }
  if (manifest.packageManager !== "npm") {
    fail(`approved-deps.json: only npm is supported (${manifest.packageManager})`);
  }

  for (const label of ["dependencies", "devDependencies"]) {
    const group = manifest[label] ?? {};
    if (typeof group !== "object" || Array.isArray(group)) {
      fail(`approved-deps.json: ${label} must be an object`);
    }
    for (const [name, version] of Object.entries(group)) {
      if (typeof name !== "string" || !name.length) {
        fail(`approved-deps.json: invalid package name in ${label}`);
      }
      if (typeof version !== "string" || !EXACT_VERSION.test(version)) {
        fail(
          `approved-deps.json: ${label}.${name} must be exact semver, got ${version}`,
        );
      }
    }
  }
}

function validatePolicy(policy) {
  if (policy.policyVersion !== 1) {
    fail(`policy.json: unsupported policyVersion ${policy.policyVersion}`);
  }
  if (!RUNTIMES.has(policy.runtime)) {
    fail(`policy.json: unsupported runtime ${policy.runtime}`);
  }
  const mode = policy.dependencyOwnershipMode ?? "strict";
  if (!OWNERSHIP_MODES.has(mode)) {
    fail(`policy.json: invalid dependencyOwnershipMode ${mode}`);
  }
}

function main() {
  const manifestPath = process.argv[2] ?? "approved-deps.json";
  const policyPath = process.argv[3] ?? "policy.json";

  let manifest;
  let policy;
  try {
    manifest = readJson(manifestPath);
    policy = readJson(policyPath);
  } catch (err) {
    fail(`Failed to read JSON: ${err.message}`);
  }

  validateManifest(manifest);
  validatePolicy(policy);

  if (manifest.runtime !== policy.runtime) {
    fail(
      `Runtime mismatch: manifest=${manifest.runtime}, policy=${policy.runtime}`,
    );
  }

  console.log(`Policy OK for ${manifest.runtime}`);
}

main();
