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
- `--preset <name>`: Conventional Commit preset (default: "angular"). Supported: angular, atom, codemirror, conventionalcommits, ember, eslint, express, jquery, jshint.
- `--create-tag`: Whether to create a git tag for the computed version (default: false)
- `--json`: Output as JSON

#### Examples

```sh
# Compute next version for main branch
npx @rb-mwindh/next-version --branches main

# Custom branches config
npx @rb-mwindh/next-version --branches main --branches "develop;prerelease=dev;channel=develop"

# Output as JSON
npx @rb-mwindh/next-version --branches main --json

# Compute and create a git tag for the next version
npx @rb-mwindh/next-version --branches main --create-tag
```

---

### GitHub Action

Add to your workflow:

```yaml
- uses: rb-mwindh/next-version@main
  id: next-version
  with:
    branches: |
      main
      develop;prerelease=dev;channel=develop
    tagFormat: 'v${version}'
    preset: angular
    createTag: false
    relnotesArtifact: release-notes

- run: |
    echo "Next version: ${{ steps.next-version.outputs.version }}"
    echo "Release channel: ${{ steps.next-version.outputs.channel }}"
    echo "Bump type: ${{ steps.next-version.outputs.type }}"
    echo "Git tag: ${{ steps.next-version.outputs.gitTag }}"
    echo "Git head: ${{ steps.next-version.outputs.gitHead }}"
    echo "Package name: ${{ steps.next-version.outputs.name }}"
    echo "Release notes path: ${{ steps.next-version.outputs.relnotesPath }}"
    echo "Release notes: ${{ steps.next-version.outputs.notes }}"
```

#### Action Inputs
- `branches`: Branch rules as multiline string (SemanticRelease format)
- `tagFormat`: Git tag format (default: "v${version}")
- `preset`: Conventional Commit preset (default: "angular"). Supported: angular, atom, codemirror, conventionalcommits, ember, eslint, express, jquery, jshint.
- `createTag`: Whether to create a git tag for the computed version (default: false). If false, the action will only compute the next version without creating a git tag.
- `relnotesArtifact`: If set, upload the release notes file as an artifact with this name

#### Action Outputs
- `version`: computed next version
- `channel`: release channel / npm dist-tag
- `type`: bump type (major, minor, patch)
- `gitTag`: last computed git tag
- `gitHead`: commit hash
- `name`: package name
- `relnotesPath`: Path to the file containing the generated release notes. This can be controlled via the `RELEASE_NOTES` environment variable (see below).
- `notes`: The generated release notes as a string (if available).

#### Release Notes Path Logic
- If the `RELEASE_NOTES` environment variable is set to a path that points to an **existing directory**, a unique filename is appended and the file is created there.
- If the `RELEASE_NOTES` environment variable is set to any other path, it is treated as a file path and that path is used directly.
- If the variable is not set, a unique file is created in the directory specified by `RUNNER_TEMP` (if set) or the system temp directory.
- The directory in which the release notes file is written (either the directory from `RELEASE_NOTES` or the parent directory of the file path) is always created if it does not exist.

#### Preset Support
All conventional-changelog presets listed below are bundled with this tool
and may be selected using the `preset` parameter (CLI) or input (GitHub Action):

- angular
- atom
- codemirror
- conventionalcommits
- ember
- eslint
- express
- jquery
- jshint

Example (CLI):
```sh
npx @rb-mwindh/next-version --branches main --preset codemirror
```

Example (GitHub Action):
```yaml
- uses: rb-mwindh/next-version@main
  with:
    branches: main
    preset: codemirror
```

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
