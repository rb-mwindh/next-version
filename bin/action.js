/*! @rb-mwindh/next-version v1.2.3 | MIT */

// src/action.ts
import fs2 from "node:fs";
import path2 from "node:path";
import * as core from "@actions/core";
import artifact from "@actions/artifact";

// src/main.ts
import semanticRelease from "semantic-release";
async function computeNextRelease(opts) {
  const { branches, tagFormat, preset, createTag, cwd } = {
    tagFormat: "v${version}",
    preset: "angular",
    createTag: false,
    cwd: process.env.GITHUB_WORKSPACE ?? process.cwd(),
    ...opts
  };
  try {
    const result = await semanticRelease({
      branches,
      tagFormat,
      ci: false,
      dryRun: !createTag,
      plugins: [
        ["@semantic-release/commit-analyzer", { preset }],
        ["@semantic-release/release-notes-generator", { preset }]
      ]
    }, {
      stdout: process.stderr,
      cwd
    });
    return result === false ? void 0 : result.nextRelease;
  } catch (err) {
    console.error("Error computing next release:", err);
    return void 0;
  }
}

// src/utils/compute-release-notes-path.ts
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
function computeReleaseNotesPath() {
  const defaultFilename = `release-notes-${process.pid}.md`;
  const tempDir = process.env.RUNNER_TEMP || os.tmpdir();
  let releaseNotesPath;
  if (process.env.RELEASE_NOTES) {
    const fileOrDirectory = process.env.RELEASE_NOTES;
    if (fs.existsSync(fileOrDirectory)) {
      if (fs.statSync(fileOrDirectory).isDirectory()) {
        releaseNotesPath = path.join(fileOrDirectory, defaultFilename);
      } else {
        releaseNotesPath = fileOrDirectory;
      }
    } else {
      if (path.extname(fileOrDirectory) === "") {
        releaseNotesPath = path.join(fileOrDirectory, defaultFilename);
      } else {
        releaseNotesPath = fileOrDirectory;
      }
    }
  } else {
    releaseNotesPath = path.join(tempDir, defaultFilename);
  }
  const targetDir = path.dirname(releaseNotesPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return releaseNotesPath;
}

// src/utils/invalid-argument-error.ts
var InvalidArgumentError = class extends Error {
  code = "commander.invalidArgument";
  constructor(message) {
    super(message);
    this.name = "InvalidArgumentError";
  }
};

// src/utils/parse-branch-rule-spec.ts
function parseBranchRuleSpec(spec) {
  const [name, ...parts] = spec.split(";").map((s) => s.trim()).filter(Boolean);
  if (!name) {
    throw new InvalidArgumentError("Missing branch name in --branches spec");
  }
  const rule = { name };
  for (const part of parts) {
    const [key, value] = part.split("=", 2).map((s) => s?.trim());
    if (!key) {
      continue;
    }
    switch (key) {
      case "prerelease":
        if (!value) {
          rule.prerelease = true;
        } else if (value === "true" || value === "false") {
          rule.prerelease = value === "true";
        } else {
          rule.prerelease = value;
        }
        break;
      case "channel":
        if (!value) {
          throw new InvalidArgumentError(`Missing value for channel in --branches spec part: "${part}"`);
        }
        rule.channel = value;
        break;
      case "range":
        if (!value) {
          throw new InvalidArgumentError(`Missing value for range in --branches spec part: "${part}"`);
        }
        if (!/^\d+(\.\d+)?\.x$/.test(value)) {
          throw new InvalidArgumentError(`Invalid format for range value in --branches spec part: "${part}". Expected format is N.N.x or N.x`);
        }
        rule.range = value;
        break;
      default:
        throw new InvalidArgumentError(`Unknown --branches segment "${key}" in branch spec part: "${part}"`);
    }
  }
  return rule;
}

// src/utils/presets.ts
var PRESETS = [
  "angular",
  "atom",
  "codemirror",
  "ember",
  "eslint",
  "express",
  "jquery",
  "jshint",
  "conventionalcommits"
];
function isPreset(arg) {
  return typeof arg === "string" && PRESETS.includes(arg);
}
function toPreset(arg) {
  return isPreset(arg) ? arg : void 0;
}

// src/action.ts
(async () => {
  try {
    const branchSpecs = core.getMultilineInput("branches", { trimWhitespace: true });
    const branches = branchSpecs.map((spec) => parseBranchRuleSpec(spec));
    const tagFormat = core.getInput("tagFormat") || void 0;
    const preset = toPreset(core.getInput("preset"));
    const createTag = core.getBooleanInput("createTag") || false;
    const relnotesArtifact = core.getInput("relnotesArtifact") || void 0;
    const result = await computeNextRelease({
      branches,
      tagFormat,
      preset,
      createTag
    });
    core.setOutput("version", result?.version ?? "");
    core.setOutput("channel", result?.channel ?? "");
    core.setOutput("type", result?.type ?? "");
    core.setOutput("gitTag", result?.gitTag ?? "");
    core.setOutput("gitHead", result?.gitHead ?? "");
    core.setOutput("name", result?.name ?? "");
    core.setOutput("notes", result?.notes ?? "");
    if (result?.notes) {
      const releaseNotesFile = computeReleaseNotesPath();
      const releaseNotesDir = path2.dirname(releaseNotesFile);
      fs2.writeFileSync(releaseNotesFile, result.notes, "utf8");
      core.setOutput("relnotesPath", releaseNotesFile);
      if (relnotesArtifact) {
        let formatSize2 = function(bytes) {
          if (bytes < 1024) return `${bytes} bytes`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
          return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        };
        var formatSize = formatSize2;
        const uploadResult = await artifact.uploadArtifact(
          relnotesArtifact,
          [releaseNotesFile],
          releaseNotesDir
        );
        const size = uploadResult.size ?? 0;
        core.info(`Artifact "${relnotesArtifact}" uploaded: total size ${formatSize2(size)}.`);
      }
    }
  } catch (err) {
    core.setFailed(err.message || String(err));
  }
})();
