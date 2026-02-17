import type {NextRelease,} from 'semantic-release';
import semanticRelease from 'semantic-release';
import {Options} from "./types.js";

export async function computeNextRelease(opts: Options): Promise<NextRelease | undefined> {
    const {branches, tagFormat, preset} = opts;

    const result = await semanticRelease({
        branches,
        tagFormat,
        plugins: [
            [ "@semantic-release/commit-analyzer", { preset } ],
            [ "@semantic-release/release-notes-generator", { preset } ]
        ]
    }, {
        stdout: process.stderr
    });

    return result === false ? undefined : result.nextRelease;
}
