# next-version

[![npm version](https://img.shields.io/npm/v/@rb-mwindh/next-version.svg)](https://www.npmjs.com/package/@rb-mwindh/next-version)

A CLI and GitHub Action to compute the next semantic version for your npm package using Conventional Commits, git tags, and the npm registry. Inspired by semantic-release, but focused on CI/CD and monorepo-friendly workflows.

---

## Features
- Computes next version based on commit history and tags
- Supports prerelease channels (e.g. develop, beta)
- Usable as a CLI or as a GitHub Action
- Customizable branch/channel rules

---

## Usage

### CLI

Install globally or use via npx:

```sh
npx @rb-mwindh/next-version --branches main
```

#### Options
- `--branches <branch...>`: Branch rules in SemanticRelease format, e.g. "main", "develop;prerelease=true", "beta;prerelease=beta;channel=beta". Option can be specified multiple times.
- `--tag-format <format>`: Git tag format (optional)
- `--preset <name>`: Conventional Commit preset (e.g. angular, atom, codemirror, ...)
- `--json`: Output as JSON

#### Examples

```sh
# Compute next version for main branch
npx @rb-mwindh/next-version --branches main

# Custom branches config
npx @rb-mwindh/next-version --branches main --branches "develop;prerelease=dev;channel=develop"

# Output as JSON
npx @rb-mwindh/next-version --branches main --json
```

---

### GitHub Action

Add to your workflow:

```yaml
- uses: rb-mwindh/next-version@main
  with:
    branches: |
      main
      develop;prerelease=dev;channel=develop
    tag-format: 'v'
    preset: 'angular'
```

#### Action Inputs
- `branches`: Branch rules as multiline string (SemanticRelease format)
- `tag-format`: Git tag format (optional)
- `preset`: Conventional Commit preset (e.g. angular)
- `relnotes_artifact`: If set, upload the release notes file as an artifact with this name

#### Action Outputs
- `version`: computed next version
- `channel`: release channel / npm dist-tag
- `type`: bump type (major, minor, patch, premajor, etc.)
- `git-tag`: last computed git tag
- `git-head`: commit hash
- `name`: package name
- `relnotes_path`: Path to the file containing the generated release notes. This can be controlled via the `RELEASE_NOTES` environment variable (see below).

#### Release Notes Path Logic
- If the `RELEASE_NOTES` environment variable is set to a directory, a unique filename is appended and the file is created there.
- If the `RELEASE_NOTES` environment variable is set to a file path, that path is used directly.
- If the variable is not set, a unique file is created in the directory specified by `RUNNER_TEMP` (if set) or the system temp directory.
- The target directory is always created if it does not exist.

---

## Development

### Build

This project uses [esbuild](https://github.com/evanw/esbuild) and [esbuild-plugin-license](https://github.com/bcherny/esbuild-plugin-license) for bundling and license generation.

```sh
npm ci
npm run build
```

- Bundles are generated in `bin/cli.js` and `bin/action.js`
- License files are automatically generated in `bin/cli.js.LICENSES.txt` and `bin/action.js.LICENSES.txt` and include all third-party licenses

---

## License

MIT © Markus Windhager

The license files in the `bin/` directory include the licenses of all used third-party dependencies.
