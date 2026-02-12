import {computeNextVersion} from "./main.js";
import {NextVersionOptions} from "./types.js";
import Npm from "./api/npm-api.js";
import Git from "./api/git-api.js";

const mockBumper = {
    tag: jest.fn().mockReturnThis(),
    loadPreset: jest.fn().mockReturnThis(),
    bump: jest.fn(),
};
jest.mock('conventional-recommended-bump', () => ({
    Bumper: jest.fn().mockImplementation(() => mockBumper)
}));

describe('computeNextVersion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // jest.spyOn(Git, 'init').mockImplementation(() => {});
        // jest.spyOn(Git, 'fetchTags').mockResolvedValue(undefined);
        // jest.spyOn(Npm, 'fetchVersions').mockReturnValue([]);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns null bump and version if branch is not configured', async () => {
        jest.spyOn(Git, 'listTags').mockResolvedValue([]);

        const result = await computeNextVersion({
            packageName: 'test-pkg',
            branches: ['main'],
            branch: 'feature/foo',
        });

        expect(result.bump).toBeNull();
        expect(result.version).toBeNull();
        expect(result.channel).toBe('latest');
    });

    it('throws if no bump is recommended and failIfNoBump is true', async () => {
        jest.spyOn(Git, 'listTags').mockResolvedValue([]);

        const opts: NextVersionOptions = {
            packageName: 'test-pkg',
            branches: ['main'],
            branch: 'main',
            failIfNoBump: true,
        };
        await expect(computeNextVersion(opts)).rejects.toThrow('No recommended bump found');
    });

    it('returns correct next version for a stable branch', async () => {
        jest.spyOn(Git, 'listTags').mockResolvedValue(['v1.2.3']);
        mockBumper.bump.mockReturnValue({ releaseType: 'minor' });
        jest.spyOn(Npm, 'fetchVersions').mockReturnValue(['1.3.0'])
        const opts: NextVersionOptions = {
            packageName: 'test-pkg',
            branches: ['main'],
            branch: 'main',
        };
        const result = await computeNextVersion(opts);
        expect(result.bump).toBe('minor');
        expect(result.version).toBe('1.3.0');
        expect(result.alreadyPublished).toBe(true);
        expect(result.channel).toBe('latest');
    });

    it('returns correct prerelease version for prerelease branch', async () => {
        jest.spyOn(Git, 'listTags').mockResolvedValue(['v1.2.3', 'v1.2.4-dev.1']);
        mockBumper.bump.mockReturnValue({ releaseType: 'patch' });
        jest.spyOn(Npm, 'fetchVersions').mockReturnValue(['1.2.4-dev.1', '1.2.4-dev.2'])
        const opts: NextVersionOptions = {
            packageName: 'test-pkg',
            branches: [{name: 'develop', prerelease: 'dev', channel: 'develop'}],
            branch: 'develop',
        };
        const result = await computeNextVersion(opts);
        expect(result.bump).toBe('prepatch');
        expect(result.version).toMatch(/^1\.2\.4-dev\.[0-9]+$/);
        expect(result.channel).toBe('develop');
        expect(result.prereleaseId).toBe('dev');
        expect(result.prereleaseCounter).toBeGreaterThan(2);
    });

    it('skips already published prerelease versions', async () => {
        jest.spyOn(Git, 'listTags').mockResolvedValue(['v1.2.3', 'v1.3.0-beta.1', 'v1.3.0-beta.2']);
        mockBumper.bump.mockReturnValue({ releaseType: 'minor' });
        jest.spyOn(Npm, 'fetchVersions').mockReturnValue(['1.3.0-beta.1', '1.3.0-beta.2']);
        const opts: NextVersionOptions = {
            packageName: 'test-pkg',
            branches: [{name: 'beta', prerelease: 'beta', channel: 'beta'}],
            branch: 'beta',
        };
        const result = await computeNextVersion(opts);
        expect(result.version).toBe('1.3.0-beta.3');
        expect(result.alreadyPublished).toBe(false);
    });

    it('returns 0.0.0 as lastStableVersion if no tags exist', async () => {
        jest.spyOn(Git, 'listTags').mockResolvedValue([]);
        jest.spyOn(Npm, 'fetchVersions').mockReturnValue([]);
        const opts: NextVersionOptions = {
            packageName: 'test-pkg',
            branches: ['main'],
            branch: 'main',
        };
        const result = await computeNextVersion(opts);
        expect(result.lastStableVersion).toBe('0.0.0');
        expect(result.lastStableTag).toBeNull();
    });

    it('throws if packageName is missing', async () => {
        const opts: NextVersionOptions = {
            packageName: '',
            branches: ['main'],
            branch: 'main',
        };
        await expect(computeNextVersion(opts)).rejects.toThrow('packageName is required');
    });

    it('throws if branches is empty', async () => {
        const opts: NextVersionOptions = {
            packageName: 'test-pkg',
            branches: [],
            branch: 'main',
        };
        await expect(computeNextVersion(opts)).rejects.toThrow('branches must not be empty');
    });

    it('returns null bump and version when configured but no bump is recommended', async () => {
        jest.spyOn(Git, 'listTags').mockResolvedValue([]);
        mockBumper.bump.mockReturnValue(null);
        jest.spyOn(Npm, 'fetchVersions').mockReturnValue([]);
        const opts: NextVersionOptions = {
            packageName: 'test-pkg',
            branches: ['main'],
            branch: 'main',
        };
        const result = await computeNextVersion(opts);
        expect(result.bump).toBeNull();
        expect(result.version).toBeNull();
        expect(result.nextBaseVersion).toBeNull();
        expect(result.alreadyPublished).toBe(false);
    });

    it('uses branch name as prerelease id when rule.prerelease is true', async () => {
        jest.spyOn(Git, 'listTags').mockResolvedValue(['v0.1.0']);
        mockBumper.bump.mockReturnValue({ releaseType: 'patch' });
        jest.spyOn(Npm, 'fetchVersions').mockReturnValue([]);
        const opts: NextVersionOptions = {
            packageName: 'test-pkg',
            branches: [{ name: 'dev', prerelease: true }],
            branch: 'dev',
        };
        const result = await computeNextVersion(opts);
        expect(result.prereleaseId).toBe('dev');
        expect(result.channel).toBe('dev');
        expect(result.version).toBe('0.1.1-dev.1');
        expect(result.bump).toBe('prepatch');
    });

    it('prefers git.tags when reachableTagsOnly is false', async () => {
        jest.spyOn(Git, 'listTags').mockResolvedValue(['v1.0.0', 'v1.1.0']);
        mockBumper.bump.mockReturnValue({ releaseType: 'patch' });
        jest.spyOn(Npm, 'fetchVersions').mockReturnValue([]);
        const opts: NextVersionOptions = {
            packageName: 'test-pkg',
            branches: ['main'],
            branch: 'main',
            reachableTagsOnly: false,
        };
        const result = await computeNextVersion(opts);
        expect(Git.listTags).toHaveBeenCalled();
        expect(result.lastStableTag).toBe('v1.1.0');
        expect(result.version).toBe('1.1.1');
    });

    it('increments prerelease counter based on the highest tag', async () => {
        jest.spyOn(Git, 'listTags').mockResolvedValue(['v1.2.3', 'v1.2.4-dev.5']);
        mockBumper.bump.mockReturnValue({ releaseType: 'patch' });
        jest.spyOn(Npm, 'fetchVersions').mockReturnValue(['1.2.4-dev.2']);
        const opts: NextVersionOptions = {
            packageName: 'test-pkg',
            branches: [{ name: 'dev', prerelease: 'dev' }],
            branch: 'dev',
        };
        const result = await computeNextVersion(opts);
        expect(result.version).toBe('1.2.4-dev.6');
        expect(result.prereleaseCounter).toBe(6);
    });
});
