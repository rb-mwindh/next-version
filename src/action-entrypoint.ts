import * as core from '@actions/core';
import { computeNextVersion } from './main.js';
import type { BranchRule } from './types.js';

async function run(): Promise<void> {
    try {
        const packageName = core.getInput('package', { required: true });
        const branchesJson = core.getInput('branches');
        const branchLines = core.getMultilineInput('branch', { trimWhitespace: true });
        const tagPrefix = core.getInput('tag-prefix') || 'v';
        const cwd = core.getInput('cwd') || process.env.GITHUB_WORKSPACE || process.cwd();
        const reachableTagsOnly = core.getBooleanInput('reachable-tags-only');
        const failIfNoBump = core.getBooleanInput('fail-if-no-bump');

        const branches = parseBranches(branchesJson, branchLines);

        core.info(`📦 Computing next version for: ${packageName}`);
        core.info(`📂 Working directory: ${cwd}`);
        core.info(`🏷️  Tag prefix: ${tagPrefix}`);
        core.info(`🌿 Branch: ${process.env.GITHUB_REF_NAME ?? 'unknown'}`);

        const result = await computeNextVersion({
            packageName,
            branches,
            cwd,
            tagPrefix,
            reachableTagsOnly,
            failIfNoBump,
        });

        // Set outputs
        core.setOutput('version', result.version ?? '');
        core.setOutput('channel', result.channel);
        core.setOutput('bump', result.bump ?? '');
        core.setOutput('already-published', String(result.alreadyPublished));
        core.setOutput('last-stable-version', result.lastStableVersion);
        core.setOutput('last-stable-tag', result.lastStableTag ?? '');
        core.setOutput('next-base-version', result.nextBaseVersion ?? '');
        core.setOutput('prerelease-id', result.prereleaseId ?? '');
        core.setOutput('prerelease-counter', result.prereleaseCounter !== undefined ? String(result.prereleaseCounter) : '');
        core.setOutput('json', JSON.stringify(result));

        // Summary
        if (result.version) {
            core.info(`✅ Next version: ${result.version}`);
            core.info(`📢 Channel: ${result.channel}`);
            core.info(`⬆️  Bump type: ${result.bump}`);

            if (result.alreadyPublished) {
                core.warning(`⚠️ Version ${result.version} is already published to npm!`);
            }

            // GitHub Actions Job Summary
            await core.summary
                .addHeading('Next Version Result', 2)
                .addTable([
                    [{ data: 'Property', header: true }, { data: 'Value', header: true }],
                    ['Version', result.version],
                    ['Channel', result.channel],
                    ['Bump Type', result.bump ?? '—'],
                    ['Last Stable Tag', result.lastStableTag ?? '—'],
                    ['Last Stable Version', result.lastStableVersion],
                    ['Next Base Version', result.nextBaseVersion ?? '—'],
                    ['Prerelease ID', result.prereleaseId ?? '—'],
                    ['Prerelease Counter', result.prereleaseCounter !== undefined ? String(result.prereleaseCounter) : '—'],
                    ['Already Published', result.alreadyPublished ? '⚠️ Yes' : 'No'],
                ])
                .write();
        } else {
            core.info('⏸️ No release recommended (no bump).');

            await core.summary
                .addHeading('Next Version Result', 2)
                .addRaw('⏸️ No release recommended (no bump).')
                .write();
        }
    } catch (error) {
        core.setFailed(error instanceof Error ? error.message : String(error));
    }
}

function parseBranches(branchesJson?: string, branchLines?: string[]): BranchRule[] {
    if (branchesJson?.trim()) {
        const parsed = JSON.parse(branchesJson) as unknown;
        if (!Array.isArray(parsed)) {
            throw new Error('Input "branches" must be a JSON array');
        }
        return parsed as BranchRule[];
    }

    if (branchLines && branchLines.length > 0) {
        return branchLines;
    }

    throw new Error('No branches configuration provided. Use "branches" (JSON) or "branch" (multiline) input.');
}

run();

