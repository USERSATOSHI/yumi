/**
 * External Dependencies
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , command, packageName] = process.argv;

if (command === 'create' && packageName) {
	const basePath = join(process.cwd(), 'packages', packageName);
	if (existsSync(basePath)) {
		console.error(`❌ Package ${packageName} already exists.`);
		process.exit(1);
	}

	console.log(`📦 Creating package: ${packageName}`);

	mkdirSync(join(basePath, 'src'), { recursive: true });

	writeFileSync(join(basePath, 'src', 'index.ts'), `// ${packageName} entry\n`);

	writeFileSync(
		join(basePath, 'tsconfig.json'),
		JSON.stringify(
			{
				extends: '../../tsconfig.base.json',
				compilerOptions: {
					composite: true,
				},
				include: ['src'],
			},
			null,
			2,
		),
	);

	writeFileSync(
		join(basePath, 'package.json'),
		JSON.stringify(
			{
				name: `@yumi/${packageName}`,
				version: '1.0.0',
				type: 'module',
				scripts: {
					dev: 'bun run src/index.ts',
					start: 'bun run src/index.ts',
					test: 'bun test',
					format: 'bunx prettier . --write',
					'check-format': 'bunx prettier . --check',
					typecheck: 'bunx tsc --noEmit',
				},
				devDependencies: {
					'@types/bun': 'latest',
					typescript: 'catalog:',
				},
			},
			null,
			2,
		),
	);

	writeFileSync(join(basePath, '.gitignore'), 'node_modules/\ndist/\n');
	writeFileSync(join(basePath, 'README.md'), `# @yumi/${packageName}\n`);

	console.log(`✅ Package @yumi/${packageName} created.`);
} else {
	console.log(`Usage: bunx yumi-cli create <package-name>`);
}
