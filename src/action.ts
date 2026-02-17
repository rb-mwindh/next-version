import fs from 'node:fs';
import * as core from '@actions/core';
import {computeNextRelease} from './main.js';
import {computeReleaseNotesPath, parseBranchRuleSpec} from './utils/index.js';
import {Preset} from "./types.js";

(async () => {
    try {
        const branchSpecs = core.getMultilineInput('branches', {trimWhitespace: true});
        const branches = branchSpecs.map(spec => parseBranchRuleSpec(spec));
        const tagFormat = core.getInput('tag-format') || undefined;
        const preset = core.getInput('preset') as Preset || 'angular';

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
            const releaseNotesPath = computeReleaseNotesPath();
            fs.writeFileSync(releaseNotesPath, result.notes, 'utf8');
            core.exportVariable('RELEASE_NOTES', releaseNotesPath);
        }
    } catch (err: any) {
        core.setFailed(err.message || String(err));
    }
})();
