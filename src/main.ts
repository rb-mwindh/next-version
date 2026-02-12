import process from "node:process";

import semver from "semver";
import {minimatch} from "minimatch";
import {Bumper} from 'conventional-recommended-bump';

import {BranchRule, BumpType, NextVersionOptions, NextVersionResult, NormalizedRule} from "./types.js";
import Git from "./api/git-api.js";
import Npm from "./api/npm-api.js";

/**
 * Compute the next version for the given branch using:
 * - Conventional Commits bump (angular preset via conventional-recommended-bump)
 * - last stable tag vX.Y.Z
 * - semantic-release-like prerelease counter from tags + registry
 * - npm registry metadata via npm view (respects .npmrc in cwd)
 */
export async function computeNextVersion(opts: NextVersionOptions): Promise<NextVersionResult> {
    const cwd = opts.cwd ?? process.cwd();
    const tagPrefix = opts.tagPrefix ?? "v";
    const reachableOnly = opts.reachableTagsOnly ?? true;
    const branch = opts.branch ?? process.env.GITHUB_REF_NAME ?? "unknown";

    if (!opts.packageName?.trim()) throw new Error("packageName is required");
    if (!opts.branches?.length) throw new Error("branches must not be empty");

    const rule = resolveBranchRule(branch, opts.branches);
    if (!rule) {
        // Not configured: do nothing / no release
        return {
            channel: "latest",
            bump: null,
            lastStableTag: null,
            lastStableVersion: "0.0.0",
            nextBaseVersion: null,
            version: null,
            alreadyPublished: false,
        };
    }

    const prereleaseId = resolvePrereleaseId(branch, rule);
    const channel = resolveChannel(rule, prereleaseId);

    Git.init({ cwd });
    await Git.fetchTags();

    const lastStableTag = await findLastStableTag(tagPrefix, reachableOnly);
    const lastStableVersion = lastStableTag ? lastStableTag.slice(tagPrefix.length) : "0.0.0";

    // Determine base bump (major|minor|patch) from conventional commits
    const baseBump = await recommendedBumpAngular({ cwd, tagPrefix });

    if (!baseBump) {
        if (opts.failIfNoBump) {
            throw new Error("No recommended bump found (no Conventional Commits requiring a release).");
        }
        // No bump => no version
        return {
            channel,
            bump: null,
            lastStableTag,
            lastStableVersion,
            nextBaseVersion: null,
            version: null,
            alreadyPublished: false,
            prereleaseId: prereleaseId ?? undefined,
        };
    }

    const nextBaseVersion = semver.inc(lastStableVersion, baseBump);
    if (!nextBaseVersion) {
        throw new Error(`Failed to increment base version: last=${lastStableVersion}, bump=${baseBump}`);
    }

    // Load registry versions once (respects .npmrc via npm in cwd)
    const registryVersions = new Set<string>(Npm.fetchVersions(opts.packageName, cwd));

    // Stable branch
    if (!prereleaseId) {
        const version = nextBaseVersion;
        const alreadyPublished = registryVersions.has(version);
        return {
            channel,
            bump: baseBump,
            lastStableTag,
            lastStableVersion,
            nextBaseVersion,
            version,
            alreadyPublished,
        };
    }

    // Prerelease branch: semantic-release-like counter dev.N from tags + registry
    const preBump: BumpType = (`pre${baseBump}` as BumpType);

    const maxFromTags = await maxPrereleaseFromTags({
        tagPrefix,
        nextBaseVersion,
        prereleaseId,
        reachableOnly,
    });

    const maxFromRegistry = maxPrereleaseFromRegistry(registryVersions, nextBaseVersion, prereleaseId);

    let n = Math.max(maxFromTags, maxFromRegistry) + 1;

    // Ensure no collision in registry (handles "publish succeeded, finalize failed" reruns)
    let version = `${nextBaseVersion}-${prereleaseId}.${n}`;
    while (registryVersions.has(version)) {
        n += 1;
        version = `${nextBaseVersion}-${prereleaseId}.${n}`;
    }

    return {
        channel,
        bump: preBump,
        lastStableTag,
        lastStableVersion,
        nextBaseVersion,
        version,
        alreadyPublished: registryVersions.has(version),
        prereleaseCounter: n,
        prereleaseId,
    };
}

/* ----------------------------- Branch rule resolution ----------------------------- */

function resolveBranchRule(branch: string, rules: BranchRule[]): NormalizedRule | null {
    const normalized: NormalizedRule[] = rules.map((r) => normalizeRule(r));

    for (const rule of normalized) {
        if (rule.nameMatchers.some((m) => matchBranch(branch, m))) {
            return rule;
        }
    }
    return null;
}

function normalizeRule(rule: BranchRule): NormalizedRule {
    if (typeof rule === "string") {
        return { nameMatchers: [rule] };
    }
    const names = Array.isArray(rule.name) ? rule.name : [rule.name];
    return {
        nameMatchers: names,
        prerelease: rule.prerelease,
        channel: rule.channel,
    };
}

function matchBranch(branch: string, matcher: string): boolean {
    // exact or glob
    return branch === matcher || minimatch(branch, matcher);
}

function resolvePrereleaseId(branch: string, rule: NormalizedRule): string | null {
    if (rule.prerelease === undefined) return null;
    if (rule.prerelease === false) return null;
    if (rule.prerelease === true) return branch; // semantic-release behavior
    return rule.prerelease;
}

function resolveChannel(rule: NormalizedRule, prereleaseId: string | null): string {
    if (rule.channel?.trim()) return rule.channel.trim();
    if (prereleaseId) return prereleaseId; // common semantic-release default
    return "latest";
}

/* ----------------------------- Git + registry helpers ----------------------------- */

async function findLastStableTag(tagPrefix: string, reachableOnly: boolean): Promise<string | null> {
    const tags = await Git.listTags(reachableOnly);

    let bestTag: string | null = null;
    let bestVer: string | null = null;

    const stableRx = new RegExp(`^${escapeRegExp(tagPrefix)}(\\d+\\.\\d+\\.\\d+)$`);

    for (const tag of tags) {
        const match = tag.match(stableRx);
        if (!match) {
            continue;
        }

        const versionCandidate = match[1];
        if (!semver.valid(versionCandidate)) {
            continue;
        }

        if (!bestVer || semver.gt(versionCandidate!, bestVer)) {
            bestVer = versionCandidate ?? null;
            bestTag = tag;
        }
    }

    return bestTag;
}

async function maxPrereleaseFromTags(args: {
    tagPrefix: string;
    nextBaseVersion: string;
    prereleaseId: string;
    reachableOnly: boolean;
}): Promise<number> {
    const { tagPrefix, nextBaseVersion, prereleaseId, reachableOnly } = args;
    const tags = await Git.listTags(reachableOnly);

    let max = 0;
    const rx = new RegExp(
        `^${escapeRegExp(tagPrefix)}${escapeRegExp(nextBaseVersion)}-${escapeRegExp(prereleaseId)}\\.(\\d+)$`
    );

    for (const t of tags) {
        // cheap filter before regex
        if (!t.startsWith(`${tagPrefix}${nextBaseVersion}-${prereleaseId}.`)) continue;
        const m = t.match(rx);
        if (!m) continue;
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > max) max = n;
    }

    return max;
}

function maxPrereleaseFromRegistry(
    versions: Set<string>,
    nextBaseVersion: string,
    prereleaseId: string
): number {
    let max = 0;
    const rx = new RegExp(`^${escapeRegExp(nextBaseVersion)}-${escapeRegExp(prereleaseId)}\\.(\\d+)$`);

    for (const v of versions) {
        const m = v.match(rx);
        if (!m) continue;
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > max) max = n;
    }
    return max;
}

/* ----------------------------- Conventional bump (angular) ----------------------------- */

async function recommendedBumpAngular(args: { cwd: string; tagPrefix: string; }): Promise<"major" | "minor" | "patch" | null> {
    const { cwd, tagPrefix } = args;
    const bumper = new Bumper(cwd);
    bumper.tag(tagPrefix);
    bumper.loadPreset('angular');
    const recommendation = await bumper.bump();
    if (recommendation && 'releaseType' in recommendation) {
        return recommendation.releaseType;
    }
    return null;
}

/* ----------------------------- util ----------------------------- */

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
