/**
 * Other Imports
 */
import js from '@eslint/js';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
/**
 * External Dependencies
 */
import { defineConfig } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Local Module Imports
 */
import eslintImportComments from './eslint-rules/eslint-import-comments.js';

export default defineConfig([
	{
		files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
		plugins: {
			js,
			import: importPlugin,
			'simple-import-sort': simpleImportSort,
			'import-comments': eslintImportComments,
		},
		extends: ['js/recommended', 'import/typescript'],
		languageOptions: {
			globals: globals.node,
		},
		rules: {
			'simple-import-sort/imports': [
				'warn',
				{
					groups: [
						// External packages
						['^node:', '^@?\\w'],

						// Internal packages (e.g. @yumi/*)
						['^@yumi(/.*)?$'],

						// Relative imports
						['^\\.'],
					],
				},
			],
			'simple-import-sort/exports': 'warn',
			'import/order': 'off',
			'import/first': 'error',
			'import-comments/insert-import-comments': 'warn',
		},
	},
	tseslint.configs.recommended,
	{
		files: ['**/*.json'],
		plugins: { json },
		language: 'json/json',
		extends: ['json/recommended'],
		ignores: ['tsconfig.json'],
	},
	{
		files: ['**/*.jsonc'],
		plugins: { json },
		language: 'json/jsonc',
		extends: ['json/recommended'],
		ignores: ['tsconfig.json'],
	},
	{
		files: ['**/*.md'],
		plugins: { markdown },
		language: 'markdown/gfm',
		extends: ['markdown/recommended'],
	},
]);
