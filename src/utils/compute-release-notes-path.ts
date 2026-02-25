import os from "node:os";
import fs from "node:fs";
import path from "node:path";

/**
 * Determines the path for the release notes file.
 *
 * - If RELEASE_NOTES env is set to an existing directory, appends a unique filename.
 * - If RELEASE_NOTES env is set to an existing file path, uses it directly.
 * - If RELEASE_NOTES env is set to a non-existent path with no extension, treats it as a directory and appends a unique filename.
 * - If RELEASE_NOTES env is set to a non-existent path with an extension, uses it directly as a file path.
 * - Otherwise, uses RUNNER_TEMP or os.tmpdir() with a unique filename.
 *
 * Also ensures the target directory exists.
 */
export function computeReleaseNotesPath(): string {
    const defaultFilename = `release-notes-${process.pid}.md`;
    const tempDir = process.env.RUNNER_TEMP || os.tmpdir();

    let releaseNotesPath: string;
    if (process.env.RELEASE_NOTES) {
        const fileOrDirectory = process.env.RELEASE_NOTES;
        if (fs.existsSync(fileOrDirectory)) {
            if (fs.statSync(fileOrDirectory).isDirectory()) {
                releaseNotesPath = path.join(fileOrDirectory, defaultFilename);
            } else {
                releaseNotesPath = fileOrDirectory;
            }
        } else {
            if (path.extname(fileOrDirectory) === '') {
                releaseNotesPath = path.join(fileOrDirectory, defaultFilename);
            } else {
                releaseNotesPath = fileOrDirectory;
            }
        }
    } else {
        releaseNotesPath = path.join(tempDir, defaultFilename);
    }

    // Ensure target directory exists
    const targetDir = path.dirname(releaseNotesPath);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, {recursive: true});
    }

    return releaseNotesPath;
}