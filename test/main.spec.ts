import {
    addTagNote,
    checkout,
    commit,
    editFile,
    GitRepo,
    merge,
    push,
    pushNotes,
    pushTags,
    tag
} from './utils/git-repo.js';
import {computeNextRelease} from '../src/main.js';
import {jest} from '@jest/globals';

describe('computeNextRelease integration', () => {
    // Increase Jest timeout for potentially slow git operations in CI environments
    jest.setTimeout(10000);

    const repo = new GitRepo();

    beforeEach(async () => {
        await repo.init();
    });
    afterAll(async () => {
        await repo.teardown();
    });

    it('returns undefined if there are no relevant commits', async () => {
        await repo.run(
            editFile('foo.txt', 'bar'),
            commit('chore: initial commit'),
            push(),
        );

        const result = await computeNextRelease({
            branches: [{name: 'main'}],
            tagFormat: 'v${version}',
            preset: 'angular',
            cwd: repo.repoDir,
        });

        expect(result).toBeUndefined();
    });

    it('returns next version after a feature commit and tag', async () => {
        await repo.run(
            editFile('foo.txt', 'hello'),
            commit('chore: initial commit'),
            tag('v1.0.0', { note: { channels: [null] } }),
            editFile('foo.txt', 'hello world'),
            commit('feat: add feature'),
            push(),
        );

        const result = await computeNextRelease({
            branches: [{name: 'main'}],
            tagFormat: 'v${version}',
            preset: 'angular',
            cwd: repo.repoDir,
        });

        expect(result?.type).toBe('minor');
        expect(result?.version).toBe('1.1.0');
        expect(result?.gitTag).toBe('v1.1.0');
    });

    it('returns prerelease version on prerelease branch', async () => {
        await repo.run(
            editFile('foo.txt', 'hello'),
            commit('chore: initial commit'),
            tag('v1.0.0', { note: { channels: [null] } }),
            checkout('develop', true),
            editFile('foo.txt', 'hello dev'),
            commit('feat: dev feature'),
            push(),
        );

        const result = await computeNextRelease({
            branches: [
                {name: 'main'},
                {name: 'develop', prerelease: true}
            ],
            tagFormat: 'v${version}',
            preset: 'angular',
            cwd: repo.repoDir,
        });


        expect(result?.version).toMatch(/^1\.1\.0-develop\.1/);
        expect(result?.type).toBe('minor');
        expect(result?.gitTag).toMatch(/^v1\.1\.0-develop\.1/);
    });

    it('should return prerelease version on prerelease branch with proper prerelease type', async () => {
        await repo.run(
            editFile('foo.txt', 'hello'),
            commit('chore: initial commit'),
            tag('v1.0.0', { note: { channels: [null] } }),

            checkout('develop', true),
            editFile('foo.txt', 'hello dev'),
            commit('feat: dev feature'),
            push(),
        );

        const result = await computeNextRelease({
            branches: [
                {name: 'main'},
                {name: 'develop', prerelease: 'rc'}
            ],
            tagFormat: 'v${version}',
            preset: 'angular',
            cwd: repo.repoDir,
        });

        expect(result?.version).toMatch(/^1\.1\.0-rc\.1/);
        expect(result?.type).toBe('minor');
        expect(result?.gitTag).toMatch(/^v1\.1\.0-rc\.1/);
    });


    it('should increment prerelease version on prerelease branch with previous prerelease type', async () => {
        await repo.run(
            editFile('foo.txt', 'initial'),
            commit('chore: initial commit'),
            tag('v1.0.0', {note: { channels: [null] } }),

            checkout('develop', true),
            editFile('foo.txt', 'hello'),
            commit('feat: a feature'),
            tag('v1.1.0-rc.1', {note: { channels: ['develop'] } }),

            editFile('foo.txt', 'hello word'),
            commit('feat: another feature'),

            push(),
        );

        const result = await computeNextRelease({
            branches: [
                {name: 'main'},
                {name: 'develop', prerelease: 'rc'}
            ],
            tagFormat: 'v${version}',
            preset: 'angular',
            cwd: repo.repoDir,
        });

        expect(result?.version).toMatch(/^1\.1\.0-rc\.2/);
        expect(result?.type).toBe('minor');
        expect(result?.gitTag).toMatch(/^v1\.1\.0-rc\.2/);
    });

    it('should create a tag when createTag = true', async () => {
        await repo.run(
            editFile('foo.txt', 'hello'),
            commit('feat: hello'),
            tag('v1.0.0', {note: { channels: [null] } }),
            editFile('foo.txt', 'hello world'),
            commit('feat: hello world'),
            push(),
        );

        const result = await computeNextRelease({
            branches: [ 'main' ],
            tagFormat: 'v${version}',
            preset: 'angular',
            cwd: repo.repoDir,
            createTag: true,
        });

        // make sure the next release has been computed correctly
        expect(result).toBeDefined();
        expect(result!.gitTag).toBe('v1.1.0');

        // make sure the tag and note have been created
        expect(await repo.tagExists('v1.1.0')).toBe(true);
        expect(await repo.refExists(`refs/notes/semantic-release-v1.1.0`)).toBe(true);
        expect(await repo.getTagNote('semantic-release', 'v1.1.0')).toMatch(/{"channels":\[null]}/);
    });

    it('should not create a tag when createTag = false', async () => {
        await repo.run(
            editFile('foo.txt', 'hello'),
            commit('feat: hello'),
            tag('v1.0.0', {note: { channels: [null] } }),
            editFile('foo.txt', 'hello world'),
            commit('feat: hello world'),
            push(),
        );

        const result = await computeNextRelease({
            branches: [ 'main' ],
            tagFormat: 'v${version}',
            preset: 'angular',
            cwd: repo.repoDir,
            createTag: false,
        });

        // make sure the next release has been computed correctly
        expect(result).toBeDefined();
        expect(result!.gitTag).toBe('v1.1.0');

        // make sure the tag and note have NOT been created
        expect(await repo.tagExists('v1.1.0')).toBe(false);
        expect(await repo.refExists(`refs/notes/semantic-release-v1.1.0`)).toBe(false);
        expect(await repo.getTagNote('semantic-release', 'v1.1.0')).toBeUndefined();
    });

});
