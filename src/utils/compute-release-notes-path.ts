import os from "node:os";
import fs from "node:fs";
import path from "node:path";

/**
 * Determines the path for the release notes file.
 *
 * - If RELEASE_NOTES env is set to a directory, appends a unique filename.
 * - If RELEASE_NOTES env is set to a file path, uses it directly.
 * - Otherwise, uses RUNNER_TEMP or os.tmpdir() with a unique filename.
 *
 * Also ensures the target directory exists.
 */
export function computeReleaseNotesPath(): string {
    const defaultFilename = `release-notes-${process.pid}.md`;
    const tempDir = process.env.RUNNER_TEMP || os.tmpdir();

    let releaseNotesPath: string;
    if (process.env.RELEASE_NOTES) {
        // Check if RELEASE_NOTES is a directory
        if (fs.existsSync(process.env.RELEASE_NOTES) && fs.statSync(process.env.RELEASE_NOTES).isDirectory()) {
            releaseNotesPath = path.join(process.env.RELEASE_NOTES, defaultFilename);
        } else {
            releaseNotesPath = process.env.RELEASE_NOTES;
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