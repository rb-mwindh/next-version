#!/usr/bin/env node
import { Command } from "commander";
import { computeNextVersion } from "./main.js";
import {BranchRule} from "./types.js";

export async function main(argv: string[] = process.argv): Promise<void> {
    const program = new Command();

    program
        .name("next-version")
        .description("Compute next version using Conventional Commits + git tags + npm registry (with semantic-release-like prerelease counter).")
        .requiredOption("-p, --package <name>", "npm package name used to query the registry, e.g. @scope/corelib")
        .option("--cwd <path>", "repo working directory (default: process.cwd())")
        .option("--tag-prefix <prefix>", 'git tag prefix (default: "v")', "v")
        .option("--current-branch <name>", "current branch name (default: GITHUB_REF_NAME)")
        .option("--branches <json>", "branches config as JSON array (subset of semantic-release: name/prerelease/channel)")
        .option(
            "--branch <name>",
            "simple branch entry (can be repeated). Equivalent to semantic-release string entry. Example: --branch main --branch develop",
            collect,
            [] as string[]
        )
        .option("--reachable-tags-only", "only consider tags reachable from HEAD (default)", true)
        .option("--all-tags", "consider all tags in repo (not just merged into HEAD)", false)
        .option("--fail-if-no-bump", "exit non-zero if no bump is recommended", false)
        .option("--json", "print result as JSON", false);

    program.parse(argv);
    const opts = program.opts<{
        package: string;
        cwd?: string;
        tagPrefix: string;
        currentBranch?: string;
        branches?: string;
        branch: string[];
        reachableTagsOnly: boolean;
        allTags: boolean;
        failIfNoBump: boolean;
        json: boolean;
    }>();

    const reachableTagsOnly = opts.allTags ? false : Boolean(opts.reachableTagsOnly);

    const branches: BranchRule[] = parseBranches(opts.branches, opts.branch);

    const res = await computeNextVersion({
        packageName: opts.package,
        branches,
        cwd: opts.cwd,
        tagPrefix: opts.tagPrefix,
        branch: opts.currentBranch,
        reachableTagsOnly,
        failIfNoBump: opts.failIfNoBump,
    });

    if (opts.json) {
        console.log(JSON.stringify(res, null, 2));
        return;
    }

    printPrettyResult(res);
}

function printPrettyResult(res: import("./types.js").NextVersionResult): void {
    const divider = "─".repeat(50);

    console.log();
    console.log(divider);
    console.log("  📦  Next Version Result");
    console.log(divider);

    if (!res.version) {
        console.log("  ⏸️  No release recommended (no bump).");
        console.log(divider);
        console.log();
        return;
    }

    const lines: [string, string][] = [
        ["Version", res.version],
        ["Channel", res.channel],
        ["Bump Type", res.bump ?? "—"],
        ["Last Stable Tag", res.lastStableTag ?? "—"],
        ["Last Stable Version", res.lastStableVersion],
        ["Next Base Version", res.nextBaseVersion ?? "—"],
    ];

    if (res.prereleaseId) {
        lines.push(["Prerelease ID", res.prereleaseId]);
    }
    if (res.prereleaseCounter !== undefined) {
        lines.push(["Prerelease Counter", String(res.prereleaseCounter)]);
    }
    lines.push(["Already Published", res.alreadyPublished ? "Yes ⚠️" : "No"]);

    const maxLabel = Math.max(...lines.map(([label]) => label.length));

    for (const [label, value] of lines) {
        const paddedLabel = label.padEnd(maxLabel);
        console.log(`  ${paddedLabel}  │  ${value}`);
    }

    console.log(divider);
    console.log();
}

function collect(value: string, previous: string[]): string[] {
    previous.push(value);
    return previous;
}

function parseBranches(branchesJson?: string, simpleBranches?: string[]): BranchRule[] {
    if (branchesJson?.trim()) {
        const parsed = JSON.parse(branchesJson) as unknown;
        if (!Array.isArray(parsed)) {
            throw new Error("--branches must be a JSON array");
        }
        return parsed as BranchRule[];
    }

    if (simpleBranches && simpleBranches.length > 0) {
        return simpleBranches;
    }

    throw new Error("No branches configuration provided. Use --branches JSON or one/more --branch entries.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    });
}
