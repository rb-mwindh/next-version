import path from 'node:path';
import * as childProcess from 'node:child_process';
import Npm, { npmHelpers } from './npm-api.js';

jest.mock('node:child_process', () => ({
    execSync: jest.fn(),
    execFileSync: jest.fn(),
}));

const mockedExecSync = childProcess.execSync as jest.Mock;
const mockedExecFileSync = childProcess.execFileSync as jest.Mock;

describe('resolveNpmPath', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.npm_execpath;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('returns npm_execpath when provided', () => {
        process.env.npm_execpath = '/usr/lib/node_modules/npm/bin/npm-cli.js';
        expect(npmHelpers.resolveNpmPath()).toBe(process.env.npm_execpath);
    });

    it('derives npm-cli.js from global node_modules when npm_execpath is absent', () => {
        mockedExecSync.mockReturnValue('/opt/node/lib/node_modules\n');
        const result = npmHelpers.resolveNpmPath();
        expect(result).toBe(path.join('/opt/node/lib/node_modules', 'npm', 'bin', 'npm-cli.js'));
        expect(mockedExecSync).toHaveBeenCalledWith('npm root -g', expect.objectContaining({ encoding: 'utf8' }));
    });

    it('falls back to platform npm binary when global lookup fails', () => {
        mockedExecSync.mockImplementation(() => { throw new Error('fail'); });
        const expected = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        expect(npmHelpers.resolveNpmPath()).toBe(expected);
    });
});

describe('resolveNpmCommand', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.npm_execpath;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('wraps npm-cli.js with node executable when npm_execpath ends with .js', () => {
        process.env.npm_execpath = '/some/npm-cli.js';
        const res = npmHelpers.resolveNpmCommand();
        expect(res).toBeDefined();
        expect(res.cmd).toBe(process.execPath);
        expect(res.argsPrefix).toEqual([process.env.npm_execpath]);
    });

    it('uses npm binary directly when fallback resolves to binary', () => {
        process.env.npm_execpath = undefined;
        mockedExecSync.mockImplementation(() => { throw new Error('fallback to binary'); });
        const res = npmHelpers.resolveNpmCommand();
        const expectedCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        expect(res).toEqual({ cmd: expectedCmd, argsPrefix: [] });
    });
});

describe('NpmApi.fetchVersions', () => {
    const cwd = '/repo';

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...process.env, npm_execpath: '/npm-cli.js' };
    });

    it('parses array output from npm view', async () => {
        mockedExecFileSync.mockReturnValue('["1.0.0","1.1.0"]\n');
        const versions = Npm.fetchVersions('pkg', cwd);
        expect(versions).toEqual(['1.0.0', '1.1.0']);
        expect(mockedExecFileSync).toHaveBeenCalledWith(
            process.execPath,
            ['/npm-cli.js', 'view', 'pkg', 'versions', '--json'],
            expect.objectContaining({ cwd, encoding: 'utf8' }));
    });

    it('returns empty array when npm view output is empty', async () => {
        mockedExecFileSync.mockReturnValue('   ');
        const versions = Npm.fetchVersions('pkg', cwd);
        expect(versions).toEqual([]);
    });

    it('handles string output from npm view', async () => {
        mockedExecFileSync.mockReturnValue('"1.2.3"');
        const versions = Npm.fetchVersions('pkg', cwd);
        expect(versions).toEqual(['1.2.3']);
    });

    it('handles object with versions array', async () => {
        mockedExecFileSync.mockReturnValue('{"versions":["2.0.0","2.1.0"]}');
        const versions = Npm.fetchVersions('pkg', cwd);
        expect(versions).toEqual(['2.0.0', '2.1.0']);
    });

    it('throws on unexpected output shape', async () => {
        mockedExecFileSync.mockReturnValue('{"foo": "bar"}');
        expect(() => Npm.fetchVersions('pkg', cwd)).toThrow('Unexpected npm view output format for versions');
    });
});

describe('npm fluent API', () => {
    const cwd = '/repo';
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...process.env, npm_execpath: '/npm-cli.js' };
    });

    it('returns parsed output when command succeeds', () => {
        mockedExecFileSync.mockReturnValue('"123"');
        const result = Npm.fetchVersions('pkg', cwd);
        expect(result).toEqual(['123']);
    });

    it('returns default value if no output and default is provided', () => {
        mockedExecFileSync.mockReturnValue('   ');
        const result = require('./npm-api').npm('view', 'pkg', 'versions', '--json')
            .withOpts({ cwd })
            ([]);
        expect(result).toEqual([]);
    });

    it('returns undefined if defaultValue is explicitly undefined', () => {
        mockedExecFileSync.mockReturnValue('   ');
        const result = require('./npm-api').npm('view', 'pkg', 'versions', '--json')
            .withOpts({ cwd })
            (undefined);
        expect(result).toBeUndefined();
    });

    it('throws if no output and no defaultValue', () => {
        mockedExecFileSync.mockReturnValue('   ');
        expect(() => require('./npm-api').npm('view', 'pkg', 'versions', '--json')
            .withOpts({ cwd })
            ()).toThrow('No output from npm');
    });

    it('withOpts overwrites previous options', () => {
        mockedExecFileSync.mockReturnValue('"1.0.0"');
        const api = require('./npm-api').npm('view', 'pkg', 'versions', '--json')
            .withOpts({ cwd: '/foo' })
            .withOpts({ cwd: '/bar' });
        api();
        expect(mockedExecFileSync).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Array),
            expect.objectContaining({ cwd: '/bar' })
        );
    });

    it('catch handler returns fallback value on error', () => {
        mockedExecFileSync.mockImplementation(() => { throw new Error('fail'); });
        const fallback = ["fallback"];
        const result = require('./npm-api').npm('view', 'pkg', 'versions', '--json')
            .catch(() => fallback)
            ();
        expect(result).toBe(fallback);
    });

    it('catch handler can rethrow error', () => {
        mockedExecFileSync.mockImplementation(() => { throw new Error('fail'); });
        expect(() => require('./npm-api').npm('view', 'pkg', 'versions', '--json')
            .catch(() => { throw new Error('custom'); })
            ()).toThrow('custom');
    });
});

describe('Npm.pkg().get', () => {
    const cwd = '/repo';
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...process.env, npm_execpath: '/npm-cli.js' };
    });

    it('returns value from npm pkg get', () => {
        mockedExecFileSync.mockReturnValue('"foo"');
        const result = Npm.pkg(cwd).get('name');
        expect(result).toBe('foo');
        expect(mockedExecFileSync).toHaveBeenCalledWith(
            process.execPath,
            ['/npm-cli.js', 'pkg', 'get', 'name', '--json'],
            expect.objectContaining({ cwd })
        );
    });
});
