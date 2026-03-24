import fs from 'node:fs';
import {build, type BuildOptions, type Plugin} from 'esbuild';
// @ts-ignore
import esbuildPluginLicense from "esbuild-plugin-license";
import pkg from './package.json' with {type: 'json'};

fs.writeFileSync('src/version.ts', ``
    + `// ╔══════════════════════════════════════════════════════════════════════╗\n`
    + `// ║         This file is auto-generated at build time.                   ║\n`
    + `// ║   Do NOT edit manually. Any changes will be overwritten.             ║\n`
    + `// ╚══════════════════════════════════════════════════════════════════════╝\n`
    + `\n`
    + `export default {\n`
    + `  name: ${JSON.stringify(pkg.name)},\n`
    + `  version: ${JSON.stringify(pkg.version)},\n`
    + `};\n`
);

const options: BuildOptions = {
    tsconfig: './tsconfig.json',
    bundle: true,
    minify: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    legalComments: 'linked',
} as const;

function template(deps: any[]): string {
    return deps
        .map((d) => {
            const name = d.packageJson?.name ?? 'UNKNOWN';
            const version = d.packageJson?.version ?? 'UNKNOWN';
            const license = d.packageJson?.license ?? 'UNKNOWN';

            const text = (
                d.licenseText ??
                d.licenseFileText ??
                d.license ??
                ''
            ).toString().trim();

            return `${name}@${version} -- ${license}\n\n${text}`;
        })
        .join(`\n\n${'-'.repeat(50)}\n\n`);
}

function licensePlugin(bundle: string) {
    return esbuildPluginLicense({
        banner: `/*! <%= pkg.name %> v<%= pkg.version %> | <%= pkg.license %> */`,
        thirdParty: {
            includePrivate: false,
            output: {
                file: `bin/${bundle}.LICENSES.txt`,
                template,
            }
        }
    });
}

function patchImportMetaUrlPlugin(): Plugin {
    return {
        name: 'patch-import-meta-url',
        setup(build) {
            build.onLoad({filter: /\.[cm]?[jt]s$/}, async (args) => {
                const contents = await fs.promises.readFile(args.path, 'utf8');
                if (!contents.includes('import.meta.url')) {
                    return null;
                }

                const loader =
                    args.path.endsWith('.ts') ? 'ts' :
                        args.path.endsWith('.mts') ? 'ts' :
                            args.path.endsWith('.cts') ? 'ts' :
                                args.path.endsWith('.jsx') ? 'jsx' :
                                    args.path.endsWith('.tsx') ? 'tsx' :
                                        'js';
                return {
                    loader,
                    contents: contents.replaceAll(
                        'import.meta.url',
                        'require("node:url").pathToFileURL(__filename).href'
                    )
                };
            })
        }
    };
}

await Promise.all([
    build({
        ...options,
        format: 'esm',
        entryPoints: ['./src/cli.ts'],
        outfile: 'bin/cli.js',
        banner: {js: '#!/usr/bin/env node\n'},
        plugins: [licensePlugin('cli.js')],
    }),
    build({
        ...options,
        format: 'cjs',
        entryPoints: ['./src/action.ts'],
        outfile: 'bin/action.cjs',
        plugins: [
            patchImportMetaUrlPlugin(),
            licensePlugin('action.cjs')
        ],
        // minify: false,
    }),
]);