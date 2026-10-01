/**
 * Builds a release end to end:
 *
 *   npm run release -- 3.2.2
 *
 * 1. sets the version in package.json, package-lock.json, Cargo.toml, Cargo.lock
 *    and tauri.conf.json
 * 2. adds a CHANGELOG.md section from the commits since the last tag, unless the
 *    version already has one (write it by hand first to use your own wording)
 * 3. runs the tests, then a signed `tauri build`
 * 4. stages everything in Releases/<version>/: installer, MSI, signatures,
 *    portable zip, checksums.txt, latest.json and RELEASE-NOTES.md
 *
 * Signing reads TAURI_SIGNING_PRIVATE_KEY, or ~/.tools4devs/updater.key with a legacy fallback.
 * It does not commit, tag or publish.
 */
import { execFileSync, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../..", import.meta.url));
const at = (...parts) => path.join(root, ...parts);
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage: npm run release -- <major.minor.patch>");
  process.exit(1);
}
const run = (command) => execSync(command, { cwd: root, stdio: "inherit" });
const step = (message) => console.log(`\n▸ ${message}`);

// ── 1. Version ──────────────────────────────────────────────────────────
step(`Version ${version}`);
function replaceIn(file, pattern, replacement, expected = 1) {
  const text = readFileSync(at(file), "utf8");
  let count = 0;
  const next = text.replace(pattern, (...match) => (count++ < expected ? replacement(...match) : match[0]));
  if (count < expected) throw new Error(`${file}: version not found`);
  writeFileSync(at(file), next);
}
const jsonVersion = /("version":\s*")[^"]+(")/g;
replaceIn("package.json", jsonVersion, (_, a, b) => `${a}${version}${b}`);
replaceIn("package-lock.json", jsonVersion, (_, a, b) => `${a}${version}${b}`, 2);
replaceIn("apps/desktop/src-tauri/tauri.conf.json", jsonVersion, (_, a, b) => `${a}${version}${b}`);
replaceIn("apps/desktop/src-tauri/Cargo.toml", /^(version = ")[^"]+(")/m, (_, a, b) => `${a}${version}${b}`);
replaceIn("apps/desktop/src-tauri/Cargo.lock", /(name = "tools4devs"\r?\nversion = ")[^"]+(")/, (_, a, b) => `${a}${version}${b}`);

// ── 2. Changelog ────────────────────────────────────────────────────────
step("Changelog");
const changelogPath = at("CHANGELOG.md");
let changelog = readFileSync(changelogPath, "utf8");
if (!changelog.includes(`## ${version} `)) {
  const lastTag = execSync("git describe --tags --abbrev=0", { cwd: root }).toString().trim();
  // A commit that only touched docs changed nothing a user of the app sees.
  const touchesTheApp = (hash) =>
    execSync(`git diff-tree --no-commit-id --name-only -r ${hash}`, { cwd: root })
      .toString().split("\n").filter(Boolean)
      .some((file) => !/^docs\/|\.md$/.test(file));
  const subjects = execSync(`git log ${lastTag}..HEAD --no-merges --format=%H%x09%s`, { cwd: root })
    .toString().split("\n").filter(Boolean)
    .map((line) => line.split("\t"))
    .filter(([hash, subject]) => !/^release\b/i.test(subject) && touchesTheApp(hash))
    .map(([, subject]) => subject.replace(/\.?$/, "."));
  const groups = { Added: [], Fixed: [], Changed: [] };
  for (const subject of subjects) {
    const [, type, text] = subject.match(/^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/) ?? [null, "", subject];
    const line = text.charAt(0).toUpperCase() + text.slice(1);
    (type === "feat" ? groups.Added : type === "fix" ? groups.Fixed : groups.Changed).push(`- ${line}`);
  }
  const body = Object.entries(groups)
    .filter(([, lines]) => lines.length)
    .map(([title, lines]) => `### ${title}\n\n${lines.join("\n")}`)
    .join("\n\n");
  const date = new Date().toISOString().slice(0, 10);
  const section = `## ${version} (${date})\n\n${body || "- Maintenance release."}\n\n`;
  changelog = changelog.replace(/^## /m, `${section}## `);
  writeFileSync(changelogPath, changelog);
  console.log(`  added from ${subjects.length} commits since ${lastTag}`);
} else {
  console.log("  already has a section, kept as written");
}
const section = changelog.split(/^## /m).find((part) => part.startsWith(`${version} `));
const notes = section.replace(/^.*\n/, "").trim().replace(/^### /gm, "## ");

// ── 3. Test and build ───────────────────────────────────────────────────
step("Tests");
run("npm test");

step("Signed build");
const signingKey = path.join(homedir(), ".tools4devs", "updater.key");
process.env.TAURI_SIGNING_PRIVATE_KEY ??= existsSync(signingKey) ? signingKey : path.join(homedir(), ".toolhaven", "updater.key");
process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ??= "";
run("npm run tauri:build");

// From 5.0.0 the updater key is new; 4.0.0 and older cannot verify these installers.
const newKeyNote = Number(version.split(".")[0]) >= 5
  ? "Updates are signed with a new key from 5.0.0, because the original one was lost. If you are on 4.0.0 or older, download and run the installer once; your preferences, history and installed tools are kept. Automatic updates work again from this version on."
  : "If you are on ToolHaven 2.1.0 or later, open the app and use the Restart button after the signed update has downloaded. The update keeps your preferences, history and installed tools.";

// ── 4. Stage ────────────────────────────────────────────────────────────
step(`Staging Releases/${version}`);
const out = at("Releases", version);
mkdirSync(out, { recursive: true });
const target = at("apps/desktop/src-tauri/target/release");
const setup = `tools4devs_${version}_x64-setup.exe`;
const msi = `tools4devs_${version}_x64_en-US.msi`;
const portable = `tools4devs_${version}_x64-portable.zip`;
for (const file of [setup, `${setup}.sig`]) copyFileSync(path.join(target, "bundle/nsis", file), path.join(out, file));
for (const file of [msi, `${msi}.sig`]) copyFileSync(path.join(target, "bundle/msi", file), path.join(out, file));

// The portable build is the executable, the bundled tools beside it, and the licence.
const staging = at("tmp", "portable");
rmSync(staging, { recursive: true, force: true });
mkdirSync(path.join(staging, "tools"), { recursive: true });
copyFileSync(path.join(target, "tools4devs.exe"), path.join(staging, "tools4devs.exe"));
copyFileSync(at("LICENSE"), path.join(staging, "LICENSE"));
execFileSync("powershell.exe", [
  "-NoProfile", "-Command",
  `Copy-Item '${at("apps/desktop/src-tauri/resources/tools")}\\*' '${path.join(staging, "tools")}'; ` +
    `Compress-Archive -Path '${staging}\\*' -DestinationPath '${path.join(out, portable)}' -Force`,
], { stdio: "inherit" });
rmSync(staging, { recursive: true, force: true });

const checksums = [portable, setup, msi]
  .map((file) => `${createHash("sha256").update(readFileSync(path.join(out, file))).digest("hex")} *${file}`)
  .join("\n");
writeFileSync(path.join(out, "checksums.txt"), `${checksums}\n`);

run(`node scripts/release/build-update-manifest.mjs "${out}"`);

writeFileSync(
  path.join(out, "RELEASE-NOTES.md"),
  `# Tools4Devs ${version}

${notes}

## Downloads

| File | What it is |
|---|---|
| \`${setup}\` | Installer (recommended) |
| \`${msi}\` | MSI, for managed deployment |
| \`${portable}\` | Portable, unzip and run |
| \`tools4devs-updates.json\`, \`tools4devs.json\`, \`latest.json\`, \`*.sig\` | Needed for automatic updates |

Windows x64 only. SHA-256 checksums are in \`checksums.txt\`. The portable build doesn't update itself. SmartScreen warns on first run because the installer isn't code-signed.

${newKeyNote}

${version === "3.4.0" ? "This is the required bridge to the new update channel. Older installed versions update to 3.4.0 first; after a restart, 3.4.0 checks tools4devs.json and can offer 4.0.0 or newer. The user restarts again to finish that update. Version 4.0.0 migrates the active identity and saved data. The old profile remains for recovery; downloaded components are copied to the new store, and the old component directory may be removed with the previous installation. Keep these exact signed v3.4.0 assets available." : Number(version.split(".")[0]) >= 5 ? "Upload all three manifests. tools4devs-updates.json advertises this release to clients of the new key; tools4devs.json stays at 4.0.0 and latest.json at the 3.4.0 bridge, for clients that can only verify the original key. Keep the v3.4.0 and v4.0.0 assets available." : "Older clients first install the signed 3.4.0 bridge, then check the tools4devs channel for this version. latest.json intentionally stays at 3.4.0; tools4devs.json advertises this release. Keep every v3.4.0 asset available and upload both manifests here."}
`,
);

step("Done");
console.log(`  ${out}`);
console.log(`  Publish as tag v${version}, and upload every file in that folder.`);
