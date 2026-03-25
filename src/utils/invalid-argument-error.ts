/**
 * Error thrown when a user-supplied argument is invalid.
 *
 * Sets `code` to `'commander.invalidArgument'` so that Commander.js
 * recognises it the same way as its own `InvalidArgumentError` –
 * without pulling in Commander as a dependency.
 */
export class InvalidArgumentError extends Error {
    readonly code = 'commander.invalidArgument';

    constructor(message: string) {
        super(message);
        this.name = 'InvalidArgumentError';
    }
}

