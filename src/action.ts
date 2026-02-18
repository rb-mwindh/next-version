import fs from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';
import artifact from '@actions/artifact';
import {computeNextRelease} from './main.js';
import {computeReleaseNotesPath, parseBranchRuleSpec} from './utils/index.js';
import {Preset} from "./types.js";

(async () => {
    try {
        const branchSpecs = core.getMultilineInput('branches', {trimWhitespace: true});
        const branches = branchSpecs.map(spec => parseBranchRuleSpec(spec));
        const tagFormat = core.getInput('tag-format') || undefined;
        const preset = core.getInput('preset') as Preset || 'angular';
        const relnotesArtifact = core.getInput('relnotes_artifact') || undefined;

        const result = await computeNextRelease({
            branches,
            tagFormat,
            preset,
        });

        core.setOutput('version', result?.version ?? '');
        core.setOutput('channel', result?.channel ?? '');
        core.setOutput('type', result?.type ?? '');
        core.setOutput('git-tag', result?.gitTag ?? '');
        core.setOutput('git-head', result?.gitHead ?? '');
        core.setOutput('name', result?.name ?? '');

        if (result?.notes) {
            const releaseNotesFile = computeReleaseNotesPath();
            const releaseNotesDir = path.dirname(releaseNotesFile);
            fs.writeFileSync(releaseNotesFile, result.notes, 'utf8');
            core.setOutput('relnotes_path', releaseNotesFile);

            if (relnotesArtifact) {
                const uploadResult = await artifact.uploadArtifact(
                    relnotesArtifact,
                    [releaseNotesFile],
                    releaseNotesDir,
                );

                function formatSize(bytes: number): string {
                    if (bytes < 1024) return `${bytes} bytes`;
                    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
                    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
                }

                const size = uploadResult.size ?? 0;
                core.info(`Artifact "${relnotesArtifact}" uploaded: total size ${formatSize(size)}.`);
            }
        }
    } catch (err: any) {
        core.setFailed(err.message || String(err));
    }
})();
