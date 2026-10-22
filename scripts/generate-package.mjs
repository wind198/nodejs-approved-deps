import fs from "node:fs";

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const RUNTIME_ENGINES = {
  "node-24": ">=24 <25",
  "node-26": ">=26 <27",
};

function parseArgs(argv) {
  const args = { check: false };
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--check") {
      args.check = true;
      continue;
    }
    if (token.startsWith("--") && i + 1 < argv.length) {
      args[token.slice(2)] = argv[++i];
    }
  }
  return args;
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function validateExactVersions(group, label) {
  for (const [name, version] of Object.entries(group ?? {})) {
    if (typeof version !== "string" || !EXACT_VERSION.test(version)) {
      throw new Error(`${label} "${name}" must use an exact semver version, got: ${version}`);
    }
  }
}

function sortKeys(obj) {
  return Object.fromEntries(
    Object.keys(obj)
      .sort()
      .map((key) => [key, obj[key]]),
  );
}

function mergeDependencyGroup(existing, approved, mode, groupLabel) {
  const approvedMap = approved ?? {};
  const existingMap = existing ?? {};

  if (mode === "strict") {
    for (const name of Object.keys(existingMap)) {
      if (!(name in approvedMap)) {
        throw new Error(
          `Strict mode: unapproved ${groupLabel} dependency "${name}" in package.json`,
        );
      }
    }
    for (const [name, version] of Object.entries(approvedMap)) {
      if (existingMap[name] !== undefined && existingMap[name] !== version) {
        // Central manifest wins; version will be updated.
      }
    }
    return sortKeys({ ...approvedMap });
  }

  const result = { ...existingMap };
  for (const [name, version] of Object.entries(approvedMap)) {
    result[name] = version;
  }
  return sortKeys(result);
}

function engineForRuntime(runtime) {
  const range = RUNTIME_ENGINES[runtime];
  if (!range) {
    throw new Error(`Unsupported runtime: ${runtime}`);
  }
  return range;
}

function buildPackageJson(consumerPkg, approved, policy) {
  if (approved.runtime !== policy.runtime) {
    throw new Error(
      `Runtime mismatch: manifest=${approved.runtime}, policy=${policy.runtime}`,
    );
  }

  if (policy.requireExactVersions !== false) {
    validateExactVersions(approved.dependencies, "dependencies");
    validateExactVersions(approved.devDependencies, "devDependencies");
  }

  const mode = policy.dependencyOwnershipMode ?? "strict";

  const result = {
    ...consumerPkg,
    engines: {
      ...(consumerPkg.engines ?? {}),
      node: engineForRuntime(approved.runtime),
    },
    dependencies: mergeDependencyGroup(
      consumerPkg.dependencies,
      approved.dependencies,
      mode,
      "dependencies",
    ),
    devDependencies: mergeDependencyGroup(
      consumerPkg.devDependencies,
      approved.devDependencies,
      mode,
      "devDependencies",
    ),
  };

  return `${JSON.stringify(result, null, 2)}\n`;
}

function main() {
  const args = parseArgs(process.argv);

  const manifestPath = args.manifest ?? "approved-deps.json";
  const policyPath = args.policy ?? "policy.json";
  const packagePath = args.package ?? "package.json";

  const approved = readJson(manifestPath);
  const policy = readJson(policyPath);
  const consumerPkg = readJson(packagePath);

  const nextContent = buildPackageJson(consumerPkg, approved, policy);

  if (args.check) {
    const current = fs.readFileSync(packagePath, "utf8");
    if (current !== nextContent) {
      console.error(
        "package.json does not match approved manifest. Run generate-package without --check.",
      );
      process.exit(1);
    }
    console.log("package.json matches approved manifest.");
    return;
  }

  fs.writeFileSync(packagePath, nextContent);
  console.log(`Updated ${packagePath} for ${approved.runtime}`);
}

main();
