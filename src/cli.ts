import {Command} from "commander";
import type {BranchObject, NextRelease} from "semantic-release";
import {parseBranchRuleSpec, toPreset} from "./utils/index.js";
import {computeNextRelease, Options} from "./main.js";
import pkg from './version.js';

function printJson(res?: NextRelease): void {
    if (res) {
        console.log(JSON.stringify(res, null, 2));
    }
}

function printPrettyResult(res?: NextRelease): void {
    const divider = '—'.repeat(50);
    console.log();
    console.log(divider);
    console.log("  📦  Next Release Result");
    console.log(divider);
    if (!res?.version) {
        console.log("  ⏸️  No release recommended (no bump).");
        console.log(divider);
        console.log();
        return;
    }
    const lines: [string, string][] = [
        ["Version", res.version],
        ["Channel", res.channel ?? '—'],
        ["Type", res.type ?? '—'],
        ["Git Tag", res.gitTag ?? '—'],
        ["Git Head", res.gitHead ?? '—'],
        ["Name", res.name ?? '—'],
    ];
    const maxLabel = Math.max(...lines.map(([label]) => label.length));
    for (const [label, value] of lines) {
        const paddedLabel = label.padEnd(maxLabel);
        console.log(`  ${paddedLabel}  │  ${value}`);
    }
    if (res.notes) {
        console.log(divider);
        console.log("  📝  Release Notes\n");
        console.log(res.notes);
        console.log(divider);
    }
    console.log();
}

async function main() {
    const program = new Command();
    program
        .name(pkg.name)
        .version(pkg.version)
        .requiredOption(
            '-b, --branches <branch...>',
            'SemanticRelease branch rule, e.g. "main", "develop;prerelease=true", "beta;prerelease=beta;channel=beta". Option may be specified multiple times.',
            (value: string, previous: BranchObject[]) => [
                ...previous,
                parseBranchRuleSpec(value),
            ],
            [],
        )
        .option(
            '-t, --tag-format <format>',
            'Tag format',
        )
        .option(
            '-p, --preset <preset>',
            'Conventional changelog preset',
            toPreset,
            'angular',
        )
        .option(
            '--create-tag',
            'Whether to create a git tag on the current workspace (default: false)',
            false,
        )
        .option(
            '--json',
            'Output JSON',
            false,
        )
        .action(async (opts: Options & { json?: boolean }) => {
            const result = await computeNextRelease(opts);
            if (opts.json) {
                printJson(result);
            } else {
                printPrettyResult(result);
            }

            const exitCode = !!result ? 0 : 1;
            process.exit(exitCode);
        });

    await program.parseAsync();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
