/**
 * Downloads every tool the manifest marks as `bundled`, verifies its SHA-256 and stages
 * the executable where the Tauri bundler picks it up. Run before `tauri build`, so a
 * clean Windows gets these tools from the installer and never has to fetch anything.
 *
 * A hash mismatch aborts the build. That is the point: an artifact that does not match
 * the pinned digest is not the artifact that was reviewed.
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rm, copyFile, writeFile, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";

const run = promisify(execFile);
const root = new URL("../../", import.meta.url);
const manifestPath = new URL("tooling/tools.json", root);
const cacheDirectory = fileURLToPath(new URL("vendor/cache/", root));
const stageDirectory = fileURLToPath(new URL("apps/desktop/src-tauri/resources/tools/", root));
const noticesPath = new URL("vendor/THIRD-PARTY-NOTICES.txt", root);
const inventoryPath = new URL("vendor/tool-inventory.json", root);

async function sha256(file) {
  const hash = createHash("sha256");
  hash.update(await readFile(file));
  return hash.digest("hex");
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** Returns the cached artifact path, downloading it only when the digest does not match. */
async function fetchArtifact(artifact) {
  const fileName = decodeURIComponent(path.basename(new URL(artifact.url).pathname));
  const cached = path.join(cacheDirectory, fileName);

  if (await exists(cached)) {
    if ((await sha256(cached)) === artifact.sha256) return cached;
    await rm(cached);
  }

  process.stdout.write(`  downloading ${fileName}
`);
  const response = await fetch(artifact.url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${artifact.url} respondeu ${response.status}`);
  await writeFile(cached, Buffer.from(await response.arrayBuffer()));

  const digest = await sha256(cached);
  if (digest !== artifact.sha256) {
    await rm(cached);
    throw new Error(
      `Digest mismatch for ${fileName}.
  expected ${artifact.sha256}
  got      ${digest}`,
    );
  }
  return cached;
}

/**
 * Windows ships bsdtar in System32, which reads zip. It is addressed by absolute path
 * because a shell may put GNU tar first on PATH, and GNU tar reads neither zip archives
 * nor `E:\...` paths. Expand-Archive is the fallback.
 */
async function unzip(archive, destination, destinationName) {
  const systemTar = path.join(process.env.SystemRoot ?? "C:\Windows", "System32", "tar.exe");
  if (await exists(systemTar)) {
    await run(systemTar, ["-xf", path.basename(archive), "-C", destinationName], { cwd: cacheDirectory });
    return;
  }
  await run("powershell", [
    "-NoProfile",
    "-Command",
    `Expand-Archive -LiteralPath '${archive}' -DestinationPath '${destination}' -Force`,
  ]);
}

/**
 * Every pinned archive holds exactly one executable. Matching it by the destination file
 * name and failing on anything but a single hit keeps the extraction unambiguous.
 */
async function extractExecutable(archive, executableName, destination) {
  const scratchName = `extract-${executableName}`;
  const scratch = path.join(cacheDirectory, scratchName);
  await rm(scratch, { recursive: true, force: true });
  await mkdir(scratch, { recursive: true });
  await unzip(archive, scratch, scratchName);

  const executables = [];
  const walk = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(entryPath);
      else if (entry.name.toLowerCase().endsWith(".exe")) executables.push(entryPath);
    }
  };
  await walk(scratch);

  // Prefer the name the tool is invoked by; some projects publish it under the asset
  // name instead (yq ships yq_windows_amd64.exe). Anything ambiguous is a build error.
  const named = executables.filter(
    (candidate) => path.basename(candidate).toLowerCase() === executableName.toLowerCase(),
  );
  const chosen = named.length === 1 ? named : executables;
  if (chosen.length !== 1) {
    throw new Error(
      `Expected exactly one executable for ${executableName} in ${path.basename(archive)}, found ${chosen.length}: ` +
        `${chosen.map((candidate) => path.basename(candidate)).join(", ")}`,
    );
  }
  await copyFile(chosen[0], destination);
  await rm(scratch, { recursive: true, force: true });
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const bundled = manifest.tools.filter((tool) => tool.status === "bundled");

  await mkdir(cacheDirectory, { recursive: true });
  await rm(stageDirectory, { recursive: true, force: true });
  await mkdir(stageDirectory, { recursive: true });

  const inventory = [];
  for (const tool of bundled) {
    process.stdout.write(`${tool.displayName} ${tool.version}\n`);
    for (const artifact of tool.artifacts) {
      const cached = await fetchArtifact(artifact);
      const executableName = path.basename(artifact.bundlePath);
      const destination = path.join(stageDirectory, executableName);

      if (cached.toLowerCase().endsWith(".exe")) await copyFile(cached, destination);
      else await extractExecutable(cached, executableName, destination);

      const staged = await stat(destination);
      process.stdout.write(`  ${executableName} (${(staged.size / 1024 / 1024).toFixed(1)} MB)\n`);
      inventory.push({
        id: tool.id,
        name: tool.displayName,
        version: tool.version,
        license: tool.licenseExpression,
        source: tool.sourceRepository,
        artifact: artifact.url,
        sha256: artifact.sha256,
        bundlePath: artifact.bundlePath,
      });
    }
  }

  await writeFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  await writeFile(
    noticesPath,
    [
      "tools4devs - third-party components shipped inside the installer",
      "",
      "Each program below is distributed as a standalone executable and invoked by",
      "tools4devs as a separate process. None of them is linked into tools4devs's code.",
      "Every project's own terms keep applying to its executable.",
      "",
      ...inventory.flatMap((entry) => [
        `${entry.name} ${entry.version}`,
        `  License: ${entry.license}`,
        `  Project: ${entry.source}`,
        `  Artifact: ${entry.artifact}`,
        `  SHA-256: ${entry.sha256}`,
        "",
      ]),
    ].join("\n"),
  );

  await copyFile(noticesPath, path.join(stageDirectory, "THIRD-PARTY-NOTICES.txt"));
  await copyFile(inventoryPath, path.join(stageDirectory, "inventory.json"));

  process.stdout.write(`
${inventory.length} executables staged in resources/tools.
`);
}

main().catch((error) => {
  process.stderr.write(`
Could not stage the bundled tools:
${error.message}
`);
  process.exitCode = 1;
});
