/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
	preset: 'ts-jest',
	testEnvironment: 'node',
	// Specify where your test files are located in a monorepo structure
	testMatch: [
		'**/packages/*/tests/**/*.test.ts', // Matches tests within any package under 'packages/'
	],
	// Ignore node_modules globally and within packages
	testPathIgnorePatterns: [
		'/node_modules/',
		// Removed "/@yumi/results/" as its tests are inside the package
	],
	// Configure module name mapper for local packages in a monorepo
	moduleNameMapper: {
		// This maps the @yumi/results package name to its source directory
		// assuming your package is at 'packages/results' and source is in 'src/'
		'^@yumi/results(.*)$': '<rootDir>/packages/results/src$1',
	},
	// Optionally, if you have a tsconfig.json in your root
	globals: {
		'ts-jest': {
			tsconfig: 'tsconfig.json',
		},
	},
};
