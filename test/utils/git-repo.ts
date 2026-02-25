import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {simpleGit, SimpleGit,} from 'simple-git';

// Debug logging, enabled via environment variable
const DEBUG = process.env.GIT_REPO_DEBUG === '1';
const debug = (...args: any[]) => {
    if (DEBUG) console.log(...args);
};

/**
 * Options for initializing a GitRepo test repository.
 *
 * @property initialFiles - Optional files to create in the repo (filename -> content).
 * @property initialBranch - Optional branch name to start on (default: repo default).
 */
export interface GitRepoOpts {
    initialFiles?: Record<string, string>;
    initialBranch?: string;
}

/**
 * Options for committing changes in the repository.
 *
 * @property allowEmpty - If true, allows creating an empty commit.
 */
export interface CommitOptions {
    allowEmpty?: boolean;
}

/**
 * Editor function for modifying file content.
 *
 * @param content - Current file content, or empty string if the file is empty or does not exist.
 * @returns New content to write (string), or undefined to delete the file.
 */
export type FileEditor = (content: string) => string | undefined;

/**
 * Command-pattern: a deferred repo operation.
 *
 * Use together with GitRepo.run(...commands).
 */
export type RepoCommand = (repo: GitRepo) => Promise<void>;

export const checkout =
    (branchName: string, create = false): RepoCommand =>
        (repo) => repo.checkout(branchName, create);

export function editFile(filePath: string, content: string): RepoCommand;
export function editFile(filePath: string, content?: undefined): RepoCommand;
export function editFile(filePath: string, editor: FileEditor): RepoCommand;
export function editFile(filePath: string, contentOrEditor: string | undefined | FileEditor): RepoCommand {
    return (repo) => repo.editFile(filePath, contentOrEditor as any);
}

export const commit =
    (message: string, options?: CommitOptions): RepoCommand =>
        (repo) => repo.commit(message, options);

export const tag =
    (tagName: string, opts?: { message?: string, note?: unknown }): RepoCommand =>
        (repo) => repo.tag(tagName, opts);

export const push =
    (opts?: { branches?: boolean, tags?: boolean, notes?: boolean }): RepoCommand =>
        (repo) => repo.push(opts);
export const pushTags = (): RepoCommand => (repo) => repo.pushTags();
export const pushNotes = (): RepoCommand => (repo) => repo.pushNotes();

export const merge =
    (fromBranch: string): RepoCommand =>
        (repo) => repo.merge(fromBranch);

export const addTagNote =
    (ref: string, tag: string, note: unknown): RepoCommand =>
        (repo) => repo.addTagNote(ref, tag, note);


/**
 * Utility for creating and manipulating a temporary git repository for integration tests.
 *
 * Usage:
 *   const repo = new GitRepo({ initialBranch: 'main' });
 *   await repo.init();
 *   await repo.editFile('foo.txt', 'bar');
 *   await repo.commit('feat: add foo');
 *   await repo.push(); // explicit push
 *   await repo.tag('v1.0.0');
 *   await repo.teardown();
 */
export class GitRepo {
    /** Absolute path to the repository root directory. */
    public readonly repoDir: string;
    /** simple-git instance for advanced git operations. */
    public readonly git: SimpleGit;
    private initialOptions: GitRepoOpts;

    /**
     * Creates a new GitRepo instance. Call {@link init} to initialize the repository.
     */
    constructor(opts?: GitRepoOpts) {
        this.repoDir = path.join(os.tmpdir(), `git-repo-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        fs.mkdirSync(this.repoDir, {recursive: true});
        this.git = simpleGit(this.repoDir);
        this.initialOptions = opts || {initialBranch: 'main'};

        debug('Created GitRepo at: ', this.repoDir);
    }

    /**
     * Remove the temporary repository and all its files.
     */
    async teardown() {
        try {
            await fs.promises.rm(this.repoDir, {recursive: true, force: true, maxRetries: 3, retryDelay: 100});
        } catch (err) {
            console.error(`Failed to remove GitRepo directory ${this.repoDir}:`, err);
        }
    }

    /**
     * Completely resets the repository to the initial state as specified in initialOptions.
     * Removes all files, re-initializes the git repository and recreates the initial branch, files, remote, hooks, and initial commit.
     */
    async init(): Promise<void> {
        debug('GitRepo.init', {repoDir: this.repoDir});

        // Clean up any existing files (in case of re-initialization)
        fs.readdirSync(this.repoDir)
            .forEach(entry => {
                fs.rmSync(path.join(this.repoDir, entry), {recursive: true, force: true});
            });

        // Re-initialize git repository
        await this.git.init();

        // Setup repository as its own remote
        const repoUrl = `file://${this.repoDir.replace(/\\/g, '/')}`;
        await this.git.addRemote('origin', repoUrl);

        await this.git.addConfig('user.name', 'Test User');
        await this.git.addConfig('user.email', 'test@example.com');

        // Setup branch
        const branch = this.initialOptions.initialBranch || 'main';
        await this.git.checkoutLocalBranch(branch);

        // Setup files
        if (this.initialOptions.initialFiles) {
            for (const [file, content] of Object.entries(this.initialOptions.initialFiles)) {
                await this.editFile(file, content);
            }
        }

        // Initial commit
        await this.commit('chore: initial commit', {allowEmpty: true});
    }

    /**
     * Edit, create, or delete a file in the repo.
     *
     * After the change, all changes (including deletions) are staged with 'git add -A'.
     *
     * @param filePath Path to the file, relative to the repo root.
     * @param content String content to write to the file (creates or overwrites the file).
     * @returns Promise<void>
     */
    async editFile(filePath: string, content: string): Promise<void>;

    /**
     * Delete a file in the repo.
     *
     * After the change, all changes (including deletions) are staged with 'git add -A'.
     *
     * @param filePath Path to the file, relative to the repo root.
     * @param content Pass undefined to delete the file.
     * @returns Promise<void>
     */
    async editFile(filePath: string, content?: undefined): Promise<void>;

    /**
     * Edit a file in the repo using an editor function.
     *
     * After the change, all changes (including deletions) are staged with 'git add -A'.
     *
     * @param filePath Path to the file, relative to the repo root.
     * @param editor Function that receives the current file content (or undefined if the file does not exist) and returns the new content (string to write, or undefined to delete the file).
     * @returns Promise<void>
     */
    async editFile(filePath: string, editor: FileEditor): Promise<void>;

    async editFile(filePath: string, contentOrEditor: string | undefined | FileEditor): Promise<void> {
        debug('GitRepo.editFile: ', {
            filePath,
            editor: typeof contentOrEditor === 'function' ? '[function]' : contentOrEditor
        });

        const absPath = path.join(this.repoDir, filePath);
        let newContent: string | undefined;

        if (typeof contentOrEditor === 'function') {
            let content: string | undefined = undefined;
            try {
                content = fs.readFileSync(absPath, 'utf8');
            } catch (e: any) {
                if (e.code !== 'ENOENT') throw e;
                content = '';
            }

            newContent = contentOrEditor(content);
        } else {
            newContent = contentOrEditor;
        }

        if (typeof newContent === 'string') {
            fs.mkdirSync(path.dirname(absPath), {recursive: true});
            fs.writeFileSync(absPath, newContent);
        } else {
            try {
                fs.unlinkSync(absPath);
            } catch (e: any) {
                if (e.code !== 'ENOENT') throw e;
            }
        }

        // stage all changes (including deletions)
        await this.git.add(['-A']);
    }

    /**
     * Checkout an existing branch or create a new one and switch to it.
     *
     * @param branchName Name of the branch to checkout or create.
     * @param create If true, creates the branch if it does not exist.
     * @returns Promise<void>
     */
    async checkout(branchName: string, create = false): Promise<void> {
        debug(`GitRepo.checkout: `, {branchName, create});

        if (create) {
            await this.git.checkoutLocalBranch(branchName);
        } else {
            await this.git.checkout(branchName);
        }
    }

    /**
     * Commit staged or all changes in the repo.
     *
     * Never pushes! Only local commits.
     *
     * @param message Commit message.
     * @param options Commit options (allowEmpty).
     * @returns Promise<void>
     */
    async commit(message: string, options?: CommitOptions): Promise<void> {
        debug(`GitRepo.commit: `, {message, options});

        const commitOptions: Record<string, any> = {};
        if (options?.allowEmpty) {
            commitOptions['--allow-empty'] = null;
        }
        await this.git.commit(message, commitOptions);
    }

    /**
     * Push commits, tags, and notes to the remote repository.
     * Branches are pushed with 'git push --all --set-upstream' to ensure the remote tracking branch is set.
     * Tags are pushed with 'git push --tags'.
     * Notes are pushed with 'git push origin refs/notes/*:refs/notes/*'.
     * @param opts
     */
    async push(opts: { branches?: boolean, tags?: boolean, notes?: boolean } = { branches: true, tags: true, notes: true }): Promise<void> {
        if (opts.branches) {
            await this.git.push(['--all', '--set-upstream']);
        }
        if (opts.tags) {
            await this.git.push(['--tags']);
        }
        if (opts.notes) {
            await this.git.push(['origin', `refs/notes/*:refs/notes/*`]);
        }
    }

    async pushTags() {
        debug('GitRepo.pushTags');
        await this.git.pushTags('origin');
    }

    async pushNotes() {
        await this.git.raw("push", 'origin', `refs/notes/*:refs/notes/*`);
    }

    /**
     * Create a tag in the repository.
     *
     * @param tagName Name of the tag to create.
     * @param opts
     * @returns Promise<void>
     */
    async tag(tagName: string, opts?: { message?: string, note?: unknown } ): Promise<void> {
        debug('GitRepo.tag: ', {tagName, opts});

        if (opts?.message) {
            await this.git.addAnnotatedTag(tagName, opts?.message);
        } else {
            await this.git.addTag(tagName);
        }

        if (opts?.note) {
            const noteContent = typeof opts.note === 'string' ? opts.note : JSON.stringify(opts.note);
            await this.git.raw("notes", "--ref", `semantic-release-${tagName}`, "add", "-f", "-m", noteContent, tagName);
        }
    }

    async tagExists(tagName: string): Promise<boolean> {
        const tags = await this.git.tags();
        return tags.all.includes(tagName);
    }

    /**
     * Merge the given branch into the current branch.
     *
     * This is a convenience wrapper for simple-git's merge.
     */
    async merge(fromBranch: string): Promise<void> {
        debug('GitRepo.merge: ', {fromBranch});
        await this.git.merge([fromBranch]);
    }

    async addTagNote(ref: string, tag: string, note: unknown) {
        await this.git.raw("notes", "--ref", `${ref}-${tag}`, "add", "-f", "-m", JSON.stringify(note), tag);
    }

    async getTagNote(ref: string, tag: string) {
        try {
            return await this.git.raw("notes", "--ref", `${ref}-${tag}`, "show", tag);
        } catch (err) {
            console.error(`Failed to get notes for tag "${tag}"`, err);
            return undefined;
        }
    }

    async refExists(ref: string): Promise<boolean> {
        try {
            const sha = await this.git.raw(['show-ref', '--verify', ref]);
            console.log(`git show-ref --verify ${ref}`, `==>`, sha);
            return true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Runs multiple repo commands sequentially.
     *
     * The command-pattern avoids "await noise" in tests:
     *   await repo.run(checkout('main'), editFile('a.txt','x'), commit('feat: x'));
     */
    async run(...commands: RepoCommand[]): Promise<void> {
        for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];
            if (!cmd) {
                continue;
            }

            try {
                await cmd(this);
            } catch (err) {
                throw new Error(
                    `GitRepo.run failed at command ${i + 1}/${commands.length}: ${(err as Error)?.message ?? String(err)}`,
                );
            }
        }
    }

    /**
     * Returns the absolute path to a file in the repository.
     * @param filePath Path relative to the repo root (can be with or without leading slash).
     */
    absPath(filePath: string): string {
        return path.join(this.repoDir, filePath.replace(/^\/\//, ''));
    }

    /**
     * Reads a file from the repository synchronously and returns its content as string.
     * Throws if the file does not exist.
     * @param filePath Path relative to the repo root (can be with or without leading slash).
     * @param encoding File encoding (default: 'utf8').
     */
    readFile(filePath: string, encoding: BufferEncoding = 'utf8'): string {
        return fs.readFileSync(this.absPath(filePath), {encoding});
    }
}
