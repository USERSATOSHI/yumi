/**
 * External Dependencies
 */
import { Project, SyntaxKind } from 'ts-morph';

/**
 * Yumi Internal Packages
 */
import { Result } from '@yumi/results';

/**
 * Local Module Imports
 */
import { YumiToolsError } from './errors';
import type { ToolSchema } from './types';

export type { ToolSchema } from './types';

/**
 * Maps TypeScript type strings to JSON Schema type strings
 *
 * @param tsType - The TypeScript type string to convert
 * @returns The corresponding JSON Schema type string
 *
 * @example
 * ```typescript
 * mapTSTypeToJSON('string') // 'string'
 * mapTSTypeToJSON('number') // 'number'
 * mapTSTypeToJSON('boolean') // 'boolean'
 * mapTSTypeToJSON('"low" | "medium" | "high"') // 'string'
 * ```
 */
function mapTSTypeToJSON(tsType: string): string {
	// Remove import(...) wrapper if present
	const cleanType = tsType.replace(/import\([^)]+\)\./g, '');

	// Check for basic types
	if (cleanType === 'string') return 'string';
	if (cleanType === 'number') return 'number';
	if (cleanType === 'boolean') return 'boolean';
	if (cleanType === 'null') return 'null';
	if (cleanType === 'undefined') return 'null';

	// Check for arrays
	if (cleanType.endsWith('[]') || cleanType.startsWith('Array<')) return 'array';

	// Check for string literal unions (e.g., "low" | "medium" | "high")
	if (/^["']/.test(cleanType) || /\s*\|\s*["']/.test(cleanType)) return 'string';

	// Check for number literal unions
	if (/^\d+(\s*\|\s*\d+)*$/.test(cleanType)) return 'number';

	// Check for union types with undefined (optional)
	if (cleanType.includes(' | undefined')) {
		return mapTSTypeToJSON(cleanType.replace(' | undefined', ''));
	}

	// Default to string for complex types
	return 'string';
}

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

			// Skip 'this' parameter (used for TypeScript typing)
			if (paramName === 'this') continue;

			const paramType = param.getType();

			// Check if this is an object binding pattern (destructured parameter)
			const nameNode = param.getNameNode();
			if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
				// Extract properties from the type
				const typeProps = paramType.getProperties();
				for (const typeProp of typeProps) {
					const propName = typeProp.getName();
					const propType = typeProp.getValueDeclaration()?.getType() ?? typeProp.getDeclaredType();
					const propTypeText = mapTSTypeToJSON(propType?.getText() ?? 'string');

					// Find matching @param tag description (format: "propName - description" or "propName description")
					const paramTag = tagMap['param']?.[i];
					let propDescription = '';
					if (paramTag) {
						// Check if this param tag matches the property name
						const match = paramTag.match(new RegExp(`^${propName}\\s*[-:]?\\s*(.*)$`));
						if (match) {
							propDescription = match[1] || '';
						}
					}

					props[propName] = { type: propTypeText, description: propDescription };

					// Check if the property is optional
					if (!typeProp.isOptional()) {
						required.push(propName);
					}
				}
				i++;
			} else {
				// Regular parameter
				const paramDescription = tagMap['param']?.[i++] || '';
				const typeText = mapTSTypeToJSON(paramType.getText());

				props[paramName] = { type: typeText, description: paramDescription };
				required.push(paramName);
			}
		}

		// convert example from ```typescript\ncode\n``` to code;
		const example =
			tagMap['example']?.[0]?.replace(/```typescript\n/, '').replace(/\n```/, '') || '';

		// Extract @intent tags (can have multiple)
		const intents = tagMap['intent'] ?? [];

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
				...(intents.length > 0 && { intents }),
			},
		});
	}
	return Result.ok(schemas);
}
