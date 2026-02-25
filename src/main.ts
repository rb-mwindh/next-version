import type {NextRelease, Options as SemanticReleaseOptions,} from 'semantic-release';
import semanticRelease from 'semantic-release';
import {Preset} from "./utils/index.js";

export type Options =
    & Pick<SemanticReleaseOptions, 'branches' | 'tagFormat'>
    & { preset?: Preset | undefined; createTag?: boolean; cwd?: string };

export async function computeNextRelease(opts: Options): Promise<NextRelease | undefined> {
    const { branches, tagFormat, preset, createTag, cwd } = {
        tagFormat: 'v${version}',
        preset: 'angular',
        createTag: false,
        cwd: process.env.GITHUB_WORKSPACE ?? process.cwd(),
        ...opts
    };

    try {
        const result = await semanticRelease({
            branches: branches,
            tagFormat: tagFormat,
            ci: !createTag,
            plugins: [
                [ "@semantic-release/commit-analyzer", { preset: preset } ],
                [ "@semantic-release/release-notes-generator", { preset: preset } ]
            ]
        }, {
            stdout: process.stderr,
            cwd: cwd,
        });

        return result === false ? undefined : result.nextRelease;

    } catch (err) {
        console.error('Error computing next release:', err);
        return undefined;
    }
}
