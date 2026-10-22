import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const generator = path.join(__dirname, "generate-package.mjs");

function runGenerator(cwd, extraArgs) {
  const result = spawnSync(
    process.execPath,
    [generator, ...extraArgs],
    { cwd, encoding: "utf8" },
  );
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }
  return result.stdout;
}

function withFixture(name, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "approved-deps-"));
  try {
    const fixtureDir = path.join(repoRoot, "fixtures", name);
    fs.copyFileSync(
      path.join(repoRoot, "approved-deps.json"),
      path.join(dir, "approved-deps.json"),
    );
    fs.copyFileSync(
      path.join(repoRoot, "policy.json"),
      path.join(dir, "policy.json"),
    );
    fs.copyFileSync(
      path.join(fixtureDir, "package.json"),
      path.join(dir, "package.json"),
    );
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

withFixture("consumer-basic", (dir) => {
  const pkgPath = path.join(dir, "package.json");
  const manifest = path.join(dir, "approved-deps.json");
  const policy = path.join(dir, "policy.json");

  runGenerator(dir, [
    "--manifest",
    manifest,
    "--policy",
    policy,
    "--package",
    pkgPath,
  ]);

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  if (pkg.name !== "my-nextjs-app" || pkg.scripts?.dev !== "next dev") {
    console.error("Generator did not preserve consumer metadata/scripts");
    process.exit(1);
  }
  if (pkg.dependencies?.next !== "15.5.9") {
    console.error("Generator did not apply approved dependency version");
    process.exit(1);
  }
  if (pkg.engines?.node !== ">=24 <25") {
    console.error("Generator did not set engines.node");
    process.exit(1);
  }

  const first = fs.readFileSync(pkgPath, "utf8");
  runGenerator(dir, [
    "--manifest",
    manifest,
    "--policy",
    policy,
    "--package",
    pkgPath,
  ]);
  const second = fs.readFileSync(pkgPath, "utf8");
  if (first !== second) {
    console.error("Generator is not idempotent");
    process.exit(1);
  }

  runGenerator(dir, [
    "--manifest",
    manifest,
    "--policy",
    policy,
    "--package",
    pkgPath,
    "--check",
  ]);
});

console.log("Generator tests passed");
