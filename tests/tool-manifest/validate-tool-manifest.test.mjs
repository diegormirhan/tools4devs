import assert from "node:assert/strict";
import test from "node:test";

import { validateToolManifest } from "../../scripts/tool-manifest/validate-tool-manifest.mjs";

const plannedTool = {
  id: "ffmpeg",
  displayName: "FFmpeg",
  status: "planned",
  delivery: "on-demand",
  sourceRepository: "https://github.com/FFmpeg/FFmpeg",
  licenseExpression: "LGPL-2.1-or-later OR GPL-2.0-or-later",
  capabilities: ["media.transcode"]
};

const bundledTool = {
  ...plannedTool,
  status: "bundled",
  version: "8.0.1",
  artifacts: [
    {
      url: "https://downloads.example.org/ffmpeg.exe",
      sha256: "a".repeat(64),
      bundlePath: "bin/ffmpeg.exe"
    }
  ]
};

function manifestWith(...tools) {
  return {
    schemaVersion: 2,
    target: "x86_64-pc-windows-msvc",
    tools
  };
}

test("requires pinned artifacts before a tool can be bundled", () => {
  const issues = validateToolManifest(
    manifestWith({ ...plannedTool, status: "bundled", version: "8.0.1" })
  );

  assert.deepEqual(issues, [
    {
      path: "tools[0].artifacts",
      message: "a pinned tool requires at least one artifact"
    }
  ]);
});

test("rejects duplicate tool identifiers", () => {
  const issues = validateToolManifest(
    manifestWith(plannedTool, { ...plannedTool, displayName: "Duplicate" })
  );

  assert.deepEqual(issues, [
    {
      path: "tools[1].id",
      message: 'duplicate tool id "ffmpeg"'
    }
  ]);
});

test("rejects insecure downloads and unsafe bundle paths", () => {
  const issues = validateToolManifest(
    manifestWith({
      ...bundledTool,
      artifacts: [
        {
          url: "http://downloads.example.org/ffmpeg.exe",
          sha256: "not-a-hash",
          bundlePath: "../ffmpeg.exe"
        }
      ]
    })
  );

  assert.deepEqual(issues, [
    {
      path: "tools[0].artifacts[0].url",
      message: "artifact URL must use HTTPS"
    },
    {
      path: "tools[0].artifacts[0].sha256",
      message: "SHA-256 must contain exactly 64 hexadecimal characters"
    },
    {
      path: "tools[0].artifacts[0].bundlePath",
      message: "bundle path must be a safe relative path"
    }
  ]);
});

test("reports unsupported schema versions and targets", () => {
  const issues = validateToolManifest({
    schemaVersion: 1,
    target: "aarch64-pc-windows-msvc",
    tools: []
  });

  assert.deepEqual(issues, [
    { path: "schemaVersion", message: "supported value is 2" },
    {
      path: "target",
      message: 'supported value is "x86_64-pc-windows-msvc"'
    }
  ]);
});

test("requires an explicit delivery strategy", () => {
  const { delivery, ...toolWithoutDelivery } = plannedTool;
  const issues = validateToolManifest(manifestWith(toolWithoutDelivery));

  assert.deepEqual(issues, [
    {
      path: "tools[0].delivery",
      message: 'delivery must be "embedded" or "on-demand"'
    }
  ]);
});

test("rejects dependencies that are not registered in the catalog", () => {
  const issues = validateToolManifest(
    manifestWith({ ...plannedTool, dependencies: ["missing-runtime"] })
  );

  assert.deepEqual(issues, [
    {
      path: "tools[0].dependencies[0]",
      message: 'unknown tool dependency "missing-runtime"'
    }
  ]);
});
