import { simpleGit, type SimpleGit } from 'simple-git';

let gitClient: SimpleGit;

// Test-only: ermöglicht das Setzen eines Mocks für gitClient
export function __setGitClientForTest(mock: SimpleGit) {
    gitClient = mock;
}

export interface GitApi {
    init(cfg?: { cwd?: string }): void;
    fetchTags(): Promise<void>;
    listTags(reachableOnly: boolean): Promise<string[]>;
}

const Git: GitApi = {
    init: (cfg?: { cwd?: string }): void => {
        gitClient = simpleGit({
            baseDir: cfg?.cwd ?? process.cwd(),
        });
    },

    fetchTags: async (): Promise<void> => {
        if (!gitClient) {
            throw new Error('Git not initialized');
        }
        try {
            await gitClient.fetch(["--tags", "--force"]);
        } catch {
            // ignore; local tags may still be sufficient
        }
    },

    listTags: async (reachableOnly: boolean): Promise<string[]> => {
        if (!gitClient) throw new Error('Git not initialized');
        if (!reachableOnly) {
            const res = await gitClient.tags();
            return res.all;
        }
        const out = await gitClient.raw(["tag", "--merged", "HEAD"]);
        return out
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
    },

};

export default Git;
export { gitClient }; // für Tests
