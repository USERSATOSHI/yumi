/**
 * External Dependencies
 */
import { Project } from 'ts-morph';

/**
 * Yumi Internal Packages
 */
import { Result } from '@yumi/results';

/**
 * Local Module Imports
 */
import { YumiToolsError } from './errors';
import type { ToolSchema } from './types';

/**
 * Generates tool schemas from all exported functions in a TypeScript file
 *
 * This function analyzes a TypeScript source file and extracts metadata from all exported
 * functions to generate tool schemas suitable for AI model tool calling. It uses the
 * ts-morph library to parse TypeScript code and extract type information.
 *
 * @param path - Path to the TypeScript source file to analyze
 * @returns Array of generated tool schemas
 *
 * @example
 * ```typescript
 * // Given a file with exported functions:
 * const schemas = generateToolSchemasFromFile('./functions.ts');
 * console.log(schemas);
 * // [
 * //   {
 * //     type: "function",
 * //     function: {
 * //       name: "timer",
 * //       description: "Sets a timer with specified duration",
 * //       parameters: {
 * //           type: "object",
 * //           properties: {
 * //               deviceHash: { type: "string" },
 * //               duration: { type: "number" }
 * //           },
 * //           required: ["deviceHash", "duration"]
 * //       }
 * //     }
 * //   }
 * // ]
 * ```
 *
 * @throws {Error} When the TypeScript file cannot be parsed or loaded
 * @throws {Error} When tsconfig.json is not found or invalid
 *
 * @remarks
 * - Only analyzes exported functions
 * - Extracts JSDoc descriptions as tool descriptions
 * - Assumes the first parameter is an object type containing all tool parameters
 * - All object properties are marked as required
 * - Complex types are simplified to basic JSON Schema types
 *
 * @see {@link mapTSTypeToJSON} for type mapping rules
 * @see {@link ToolSchema} for the return type structure
 *
 * @since 1.0.0
 */
export function generateToolSchemasFromFile(path: string): Result<ToolSchema[], YumiToolsError> {
	let source;
	let project;
	try {
		project = new Project({ tsConfigFilePath: 'tsconfig.json' });
	} catch {
		return Result.err(YumiToolsError.MissingTsConfig);
	}

	if (!project) {
		return Result.ok([]);
	}

	try {
		source = project.addSourceFileAtPath(path);
	} catch {
		return Result.err(YumiToolsError.ParseFailed);
	}

	const schemas: ToolSchema[] = [];
	for (const fn of source.getFunctions()) {
		console.log(fn.getNameOrThrow());
		if (!fn.isExported()) continue;
		const name = fn.getNameOrThrow();
		const jsDocs = fn.getJsDocs();
		const description = jsDocs[0]?.getDescription().trim() || '';

		const params = fn.getParameters();

		const props: ToolSchema['function']['parameters']['properties'] = {};
		const required: string[] = [];
		const tags = jsDocs[0]?.getTags() || [];
		const tagMap: Record<string, string[]> = {};
		for (const tag of tags) {
			const tagComment = tag.getComment();
			if (!tagComment) continue;
			if (!tagMap[tag.getTagName()]) {
				// Initialize the tagMap entry if it doesn't exist
				tagMap[tag.getTagName()] = [];
			}
			if (Array.isArray(tagComment)) {
				// If the tag comment is an array, join it into a single string
				tagMap[tag.getTagName()]?.push(tagComment.join(' ').trim());
			} else {
				tagMap[tag.getTagName()]?.push(tagComment.trim());
			}
		}

		let i = 0;
		// Handle multiple parameters
		for (const param of params) {
			const paramName = param.getName();
			const paramType = param.getType();
			const paramDescription = tagMap['param']?.[i++] || '';
			const typeText = paramType.getText();

			props[paramName] = { type: typeText, description: paramDescription };
			required.push(paramName);
		}

		// convert example from ```typescript\ncode\n``` to code;
		const example =
			tagMap['example']?.[0]?.replace(/```typescript\n/, '').replace(/\n```/, '') || '';

		schemas.push({
			type: 'function',
			function: {
				name,
				description,
				parameters: {
					type: 'object',
					properties: props,
					required,
				},
				example,
			},
		});
	}
	return Result.ok(schemas);
}
