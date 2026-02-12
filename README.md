# next-version

[![npm version](https://img.shields.io/npm/v/@rb-mwindh/next-version.svg)](https://www.npmjs.com/package/@rb-mwindh/next-version)

A CLI and GitHub Action to compute the next semantic version for your npm package using Conventional Commits, git tags, and the npm registry. Inspired by semantic-release, but focused on CI/CD and monorepo-friendly workflows.

---

## Features
- Computes next version based on commit history and tags
- Supports prerelease channels (e.g. develop, beta) with semantic-release-like counters
- Integrates with npm registry to avoid version collisions
- Usable as a CLI or as a GitHub Action
- Customizable branch/channel rules

---

## Usage

### CLI

Install globally or use via npx:

```sh
npx @rb-mwindh/next-version --package <name> --branch main
```

#### Options
- `--package <name>`: npm package name (required)
- `--cwd <path>`: working directory (default: current)
- `--tag-prefix <prefix>`: git tag prefix (default: "v")
- `--current-branch <name>`: branch name (default: GITHUB_REF_NAME)
- `--branches <json>`: branches config as JSON array (semantic-release format)
- `--branch <name>`: simple branch entry (repeatable)
- `--reachable-tags-only`: only tags reachable from HEAD (default)
- `--all-tags`: consider all tags in repo
- `--fail-if-no-bump`: exit non-zero if no bump is recommended
- `--json`: print result as JSON

#### Examples

```sh
# Compute next version for main branch
npx @rb-mwindh/next-version --package @scope/corelib --branch main

# Use custom branches config (semantic-release style)
npx @rb-mwindh/next-version --package mylib --branches '[{"name":"main"},{"name":"develop","prerelease":"dev"}]'

# Output as JSON
npx @rb-mwindh/next-version --package mylib --branch main --json
```

---

### GitHub Action

Add to your workflow:

```yaml
- uses: rb-mwindh/next-version@main
  with:
    package: '@scope/corelib'
    branch: main
    tag-prefix: 'v'
    cwd: ${{ github.workspace }}
```

#### Action Inputs
- `package`: npm package name (required)
- `branches`: branches config as JSON array (semantic-release format)
- `branch`: simple branch entry (repeatable)
- `tag-prefix`: git tag prefix (default: "v")
- `cwd`: working directory (default: GITHUB_WORKSPACE)
- `reachable-tags-only`: only tags reachable from HEAD (default: true)
- `fail-if-no-bump`: fail if no bump is recommended (default: false)

#### Action Outputs
- `version`: computed next version
- `channel`: release channel / npm dist-tag
- `bump`: bump type (major, minor, patch, premajor, etc.)
- `already-published`: whether this version is already published
- `last-stable-version`: last stable version from tags
- `last-stable-tag`: last stable git tag
- `next-base-version`: next base version (X.Y.Z)
- `prerelease-id`: prerelease identifier (if applicable)
- `prerelease-counter`: prerelease counter (if applicable)
- `json`: full result as JSON

---

## Development

### Build

This project uses [@vercel/ncc](https://github.com/vercel/ncc) to bundle all runtime dependencies for CLI and GitHub Action. The output is committed to `bin/`.

```sh
npm ci
npm run build
```

- TypeScript builds to `dist/`
- Bundles are created in `bin/cli/` and `bin/action/`
- Only `bin/` is versioned (see .gitignore)

---

## License

MIT © Markus Windhager
