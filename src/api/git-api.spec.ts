import Git from './git-api.js';
import * as simpleGit from 'simple-git';

jest.mock('simple-git');

describe('Git API', () => {
    let mockGit: any;
    beforeEach(() => {
        jest.clearAllMocks();
        mockGit = {
            fetch: jest.fn().mockResolvedValue(undefined),
            tags: jest.fn().mockResolvedValue({ all: ['v1.0.0', 'v1.1.0'] }),
            raw: jest.fn().mockResolvedValue('v1.0.0\nv1.1.0\n'),
        };
        (simpleGit.simpleGit as jest.Mock).mockReturnValue(mockGit);
        Git.init({ cwd: '/repo' });
    });

    it('initializes gitClient with provided cwd (noop in test)', () => {
        expect(mockGit).toBeDefined();
    });

    it('fetchTags calls gitClient.fetch with correct args', async () => {
        await Git.fetchTags();
        expect(mockGit.fetch).toHaveBeenCalledWith(["--tags", "--force"]);
    });

    it('fetchTags does not throw if fetch fails', async () => {
        mockGit.fetch.mockRejectedValue(new Error('fail'));
        await expect(Git.fetchTags()).resolves.toBeUndefined();
    });

    it('listTags returns all tags if reachableOnly is false', async () => {
        mockGit.tags.mockResolvedValue({ all: ['v1.0.0', 'v1.1.0'] });
        const tags = await Git.listTags(false);
        expect(tags).toEqual(['v1.0.0', 'v1.1.0']);
    });

    it('listTags returns reachable tags if reachableOnly is true', async () => {
        mockGit.raw.mockResolvedValue('v1.0.0\nv1.1.0\n');
        const tags = await Git.listTags(true);
        expect(tags).toEqual(['v1.0.0', 'v1.1.0']);
    });

    it('listTags filters out empty lines from raw output', async () => {
        mockGit.raw.mockResolvedValue('v1.0.0\n\n  \nv1.1.0\n');
        const tags = await Git.listTags(true);
        expect(tags).toEqual(['v1.0.0', 'v1.1.0']);
    });

    it('throws if listTags is called before init', async () => {
        // simulate uninitialized by making simpleGit return undefined
        (simpleGit.simpleGit as jest.Mock).mockReturnValue(undefined);
        Git.init();
        await expect(Git.listTags(false)).rejects.toThrow('Git not initialized');
    });

    it('throws if fetchTags is called before init', async () => {
        // simulate uninitialized by making simpleGit return undefined
        (simpleGit.simpleGit as jest.Mock).mockReturnValue(undefined);
        Git.init();
        await expect(Git.fetchTags()).rejects.toThrow('Git not initialized');
    });
});
