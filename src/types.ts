export type BumpType =
    | "major"
    | "minor"
    | "patch"
    | "premajor"
    | "preminor"
    | "prepatch"
    | "prerelease";

export type BranchRule =
    | string
    | {
    /**
     * Branch selector. In semantic-release this can be more complex; here we support:
     * - exact name (e.g. "main")
     * - glob patterns (e.g. "release/*")
     * - array of selectors
     */
    name: string | string[];

    /**
     * If true => prerelease id is derived from the branch name
     * If string => prerelease id is that string (e.g. "dev")
     */
    prerelease?: boolean | string;

    /**
     * Release channel / dist-tag (e.g. "latest", "develop", "beta").
     * If omitted:
     * - stable => "latest"
     * - prerelease => prerelease id
     */
    channel?: string;
};

export interface NextVersionOptions {
    /**
     * npm package name used to query the registry for existing versions.
     * Example: "@scope/corelib"
     */
    packageName: string;

    /**
     * Branch rules similar to semantic-release branches option (subset: name/prerelease/channel).
     * Example:
     * [
     *   "main",
     *   { name: "develop", prerelease: "dev", channel: "develop" }
     * ]
     */
    branches: BranchRule[];

    /**
     * Current branch name; defaults to GITHUB_REF_NAME or "unknown".
     */
    branch?: string | undefined;

    /**
     * Directory of the git repo / workspace. Defaults to process.cwd().
     */
    cwd?: string | undefined;

    /**
     * Git tag prefix. Defaults to "v" (so tags like v1.2.3).
     */
    tagPrefix?: string;

    /**
     * Whether to consider only tags reachable from HEAD.
     * Default: true (semantic-release-ish behavior).
     */
    reachableTagsOnly?: boolean;

    /**
     * If true, throws when no bump is recommended.
     * Default: false (returns bump=null, version=null).
     */
    failIfNoBump?: boolean;
}

export interface NextVersionResult {
    /**
     * Release channel / dist-tag (e.g. latest, develop, beta)
     */
    channel: string;

    /**
     * Bump type. For prerelease branches we return premajor/preminor/prepatch,
     * or prerelease if no base bump was found but we are continuing prereleases.
     *
     * If no bump is recommended and failIfNoBump=false => null.
     */
    bump: BumpType | null;

    /**
     * Final computed version:
     * - stable: X.Y.Z
     * - prerelease: X.Y.Z-<preid>.<N>
     *
     * null if bump=null and failIfNoBump=false.
     */
    version: string | null;

    /**
     * Whether package@version already exists in the registry.
     * Meaningful only when version != null.
     */
    alreadyPublished: boolean;

    lastStableTag: string | null;
    lastStableVersion: string; // defaults to 0.0.0 when no tag is found

    /**
     * Next base version (X.Y.Z) after applying major/minor/patch bump.
     * null if bump=null and failIfNoBump=false.
     */
    nextBaseVersion: string | null;

    /**
     * If prerelease: the computed counter N in X.Y.Z-preid.N
     */
    prereleaseCounter?: number;

    /**
     * The prerelease identifier used (e.g. "dev", "beta") if prerelease.
     */
    prereleaseId?: string | undefined;
}

export type NormalizedRule = {
    nameMatchers: string[];
    prerelease?: boolean | string | undefined;
    channel?: string | undefined;
};