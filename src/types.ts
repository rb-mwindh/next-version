import type {Options as SemanticReleaseOptions} from "semantic-release";

export type Preset =
    | 'angular'
    | 'atom'
    | 'codemirror'
    | 'ember'
    | 'eslint'
    | 'express'
    | 'jquery'
    | 'jshint'
    | 'conventionalcommits';

export type Options =
    & Pick<SemanticReleaseOptions, 'branches' | 'tagFormat'>
    & { preset: Preset };