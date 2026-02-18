import {InvalidArgumentError} from "commander";
import {BranchObject} from "semantic-release";

/**
 * Parse a branch rule specification string into a BranchRule object.
 *
 * The spec format is:
 * "<name>[;key[=value]]..."
 *
 * - `name`: branch name or patterns (e.g. "main", "develop", "release/*")
 * - `key=value` pairs for additional options:
 *   - `prerelease`: if present without value => true, if value is "true"/"false" => boolean, otherwise string
 *   - `channel`: string value for the release channel
 *   - `range`: applies to maintenance branches, is required and must be formatted like `N.N.x` or `N.x`
 *
 * @example
 * parseBranchRuleSpec("main") => { name: "main" }
 * parseBranchRuleSpec("develop;prerelease=dev;channel=develop") => { name: "develop", prerelease: "dev", channel: "develop" }
 * parseBranchRuleSpec("release/*;prerelease") => { name: "release/*", prerelease: true }
 * parseBranchRuleSpec("main;channel=stable") => { name: "main", channel: "stable" }
 * Invalid specs will throw an InvalidArgumentError with a descriptive message.
 *
 * @param spec The branch rule specification string to parse.
 * @returns The parsed BranchRule object.
 * @throws {InvalidArgumentError} If the spec is invalid (e.g. missing names, unknown keys).
 */
export function parseBranchRuleSpec(spec: string): BranchObject {
    // spec: "<name>[;key[=value]]..."
    // name: e.g. "main", "develop", "release/*"

    const [name, ...parts] = spec.split(';')
        .map(s => s.trim())
        .filter(Boolean);

    if (!name) {
        throw new InvalidArgumentError('Missing branch name in --branches spec');
    }

    const rule: BranchObject = { name };

    for (const part of parts) {
        const [key, value] = part.split('=', 2).map(s => s?.trim());

        if (!key) {
            continue; // skip empty parts
        }

        switch (key) {
            case 'prerelease':
                if (!value) {
                    rule.prerelease = true;
                } else if (value === 'true' || value === 'false') {
                    rule.prerelease = (value === 'true');
                } else {
                    rule.prerelease = value;
                }
                break;
            case 'channel':
                if (!value) {
                    throw new InvalidArgumentError(`Missing value for channel in --branches spec part: "${part}"`);
                }
                rule.channel = value;
                break;
            case 'range':
                if (!value) {
                    throw new InvalidArgumentError(`Missing value for range in --branches spec part: "${part}"`);
                }
                if (!/^\d+\.\d+(\.x)?$/.test(value)) {
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