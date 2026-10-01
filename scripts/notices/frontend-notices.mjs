/**
 * Writes the notices for the libraries and fonts inside the interface bundle, next to
 * the tools' THIRD-PARTY-NOTICES.txt. Run after tools:stage, which empties that folder.
 *
 * It lists every production package in the lockfile, not only what the bundler kept:
 * over-listing costs a few lines, under-listing breaks a licence. A package whose licence
 * is not permissive stops the build, because the installer ships permissive code only
 * (docs/LICENSING.md).
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const permissive = new Set([
  "MIT", "ISC", "0BSD", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "Unlicense", "CC0-1.0", "OFL-1.1",
]);

/** An SPDX expression is permissive when some OR-branch has only permissive AND-terms. */
export function isPermissive(expression) {
  if (typeof expression !== "string") return false;
  return expression
    .replace(/[()]/g, "")
    .split(/\s+OR\s+/)
    .some((branch) => branch.split(/\s+AND\s+/).every((term) => permissive.has(term.trim())));
}

export function productionPackages(lock) {
  const seen = new Set();
  const packages = [];
  for (const [packagePath, entry] of Object.entries(lock.packages)) {
    if (!packagePath.startsWith("node_modules/") || entry.dev || entry.devOptional) continue;
    const name = entry.name ?? packagePath.slice(packagePath.lastIndexOf("node_modules/") + "node_modules/".length);
    const key = `${name}@${entry.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    packages.push({ name, version: entry.version, license: entry.license, path: packagePath });
  }
  return packages.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

export function renderFrontendNotices(packages) {
  const refused = packages.filter((entry) => !isPermissive(entry.license));
  if (refused.length) {
    throw new Error(
      `Not permissive, cannot ship in the installer:\n${refused.map((entry) => `  ${entry.name} ${entry.version}: ${entry.license}`).join("\n")}`,
    );
  }
  return [
    "tools4devs - libraries and fonts inside the interface",
    "",
    "These are compiled into the application window. Each keeps its own licence,",
    "reproduced below as its package publishes it.",
    "",
    ...packages.flatMap((entry) => [
      "-".repeat(78),
      `${entry.name} ${entry.version}`,
      `  License: ${entry.license}`,
      ...(entry.licenceText
        ? ["", entry.licenceText.trim()]
        : [`  No licence file in the published package; see ${entry.repository ?? "the npm registry entry"}`]),
      "",
    ]),
  ].join("\n");
}

function repositoryUrl(repository) {
  const raw = typeof repository === "string" ? repository : repository?.url;
  if (!raw) return null;
  const url = raw.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://");
  if (/^(github:)?[\w.-]+\/[\w.-]+$/.test(url)) return `https://github.com/${url.replace(/^github:/, "")}`;
  return url;
}

function main() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
  const packages = productionPackages(lock).map((entry) => {
    const directory = path.join(root, entry.path);
    if (!existsSync(directory)) throw new Error(`${entry.name} is in the lockfile but not installed; run npm install.`);
    const manifest = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));
    const licenceFile = readdirSync(directory).find((file) => /^(licen[sc]e|copying)/i.test(file));
    return {
      ...entry,
      licenceText: licenceFile ? readFileSync(path.join(directory, licenceFile), "utf8") : null,
      repository: repositoryUrl(manifest.repository),
    };
  });

  const stage = path.join(root, "apps/desktop/src-tauri/resources/tools");
  mkdirSync(stage, { recursive: true });
  writeFileSync(path.join(stage, "FRONTEND-NOTICES.txt"), renderFrontendNotices(packages));
  process.stdout.write(`${packages.length} interface packages listed in FRONTEND-NOTICES.txt.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`\nCould not write the interface notices:\n${error.message}\n`);
    process.exitCode = 1;
  }
}
