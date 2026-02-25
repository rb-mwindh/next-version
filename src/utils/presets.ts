export const PRESETS = [
    'angular',
    'atom',
    'codemirror',
    'ember',
    'eslint',
    'express',
    'jquery',
    'jshint',
    'conventionalcommits',
] as const;

export type Preset = typeof PRESETS[number];

export function isPreset(arg: unknown): arg is Preset {
    return typeof arg === 'string' && (PRESETS as unknown as string[]).includes(arg);
}

export function toPreset(arg: unknown): Preset | undefined {
    return isPreset(arg) ? arg : undefined;
}