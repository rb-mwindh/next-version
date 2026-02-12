import {execFileSync, execSync, ExecFileSyncOptions} from "node:child_process";
import path from "node:path";

export const npmHelpers = {
    resolveNpmPath(): string {
        // Prefer npm_execpath (points to npm-cli.js when executed via npm)
        const npmExecPath = process.env.npm_execpath;
        if (npmExecPath) {
            return npmExecPath;
        }

        // Fallback: derive npm-cli.js from global node_modules
        try {
            const globalNodeModules = execSync("npm root -g", {
                encoding: "utf8",
                stdio: ["ignore", "pipe", "ignore"],
            }).trim();

            return path.join(globalNodeModules, "npm", "bin", "npm-cli.js");
        } catch (e) {
            // Last resort: assume npm is on PATH (platform-specific)
            return process.platform === "win32" ? "npm.cmd" : "npm";
        }
    },

    resolveNpmCommand(): { cmd: string; argsPrefix: string[] } {
        const npmPath = npmHelpers.resolveNpmPath();

        // If npmPath points to the CLI script, run it with the current node; otherwise execute directly
        if (npmPath.endsWith(".js")) {
            return { cmd: process.execPath, argsPrefix: [npmPath] };
        }

        return { cmd: npmPath, argsPrefix: [] };
    },

}

export interface NpmApi {
    pkg(cwd?: string): {
        get(path: string): string | undefined;
    };
    fetchVersions(packageName: string, cwd: string): string[];
}

/**
 * Error handler for npm fluent API. May return a fallback value or throw an error.
 */
export interface NpmErrorHandler<T = unknown> {
    (err: unknown): T | never;
}

// Fluent API für npm (callable object)
export function npm(...args: string[]) {
    let opts: ExecFileSyncOptions = {};
    let errorHandler: NpmErrorHandler | undefined = undefined;

    function executor<T = unknown>(defaultValue?: T): T {
        try {
            const { cmd, argsPrefix } = npmHelpers.resolveNpmCommand();
            const stdout = execFileSync(
                cmd,
                [...argsPrefix, ...args],
                { encoding: "utf8", ...opts }
            );
            const str = typeof stdout === "string" ? stdout : stdout.toString("utf8");
            const trimmed = str.trim();

            // Throw an error when npm returns no output.
            // This is caught below and can be handled by the errorHandler or return the defaultValue if provided.
            if (!trimmed) {
                throw new Error("No output from npm");
            }
            return JSON.parse(trimmed);
        } catch (e) {
            if (errorHandler) {
                return errorHandler(e) as T;
            }
            if (arguments.length > 0) {
                return defaultValue as T;
            }
            throw e;
        }
    }

    executor.withOpts = function(newOpts: ExecFileSyncOptions) {
        opts = newOpts || {};
        return executor;
    };
    executor.catch = function<T>(handler: NpmErrorHandler<T>) {
        errorHandler = handler;
        return executor;
    };
    return executor;
}

// fetchVersions nutzt die neue API:
const Npm: NpmApi = {
    fetchVersions: (packageName: string, cwd: string): string[] => {
        const parsed = npm("view", packageName, "versions", "--json")
            .withOpts({ cwd })
            ([] as string[]);

        if (Array.isArray(parsed)) {
            return parsed.map(String);
        }
        if (typeof parsed === "string") {
            return [parsed];
        }
        if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).versions)) {
            return (parsed as any).versions.map((v: unknown) => String(v));
        }
        throw new Error("Unexpected npm view output format for versions");
    },
    pkg: (cwd: string = process.cwd()) => ({
        get<T = unknown>(path: string): T {
            return npm('pkg', 'get', path, '--json').withOpts({ cwd })() as T;
        },
    })
};

export default Npm;

