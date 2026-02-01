/**
 * External Dependencies
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Yumi Internal Packages
 */
import { generateToolSchemasFromFile, type ToolSchema } from '@yumi/tools';
import { getTaskToolSchemas, getTaskIntentMapping } from '@yumi/tasks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Core tool schemas (media, device, LEDfx, etc.) */
const coreTools = generateToolSchemasFromFile(resolve(__dirname, 'tools.ts')).unwrap()!;

/** Task tool schemas from @yumi/tasks (reminders, todos) */
const taskTools = getTaskToolSchemas();

/** Full tool schemas - core + tasks */
export const tools: ToolSchema[] = [...coreTools, ...taskTools];

/** Parameter names that represent device identifiers - AI shouldn't provide these */
const DEVICE_HASH_PARAMS = ['hash', 'deviceHash'] as const;

/** Tools that require a device hash to be injected */
export const DEVICE_TOOLS = new Set([
	'changeLedFxScene',
	'playMedia',
	'pauseMedia',
	'stopMedia',
	'nextMediaTrack',
	'previousMediaTrack',
	'setMediaVolume',
	'muteDevice',
	'shutdownDevice',
	'sleepDevice',
	'lockDevice'
]);

/** Media control tools - these should target devices that are actively playing */
export const MEDIA_TOOLS = new Set([
	'playMedia',
	'pauseMedia',
	'stopMedia',
	'nextMediaTrack',
	'previousMediaTrack',
	'setMediaVolume',
	'muteMedia',
	'changeLedFxScene', // LEDfx runs on media devices
]);

/**
 * Auto-generated intent-to-tools mapping from @intent JSDoc tags.
 * Built at startup from tool schemas.
 */
export const INTENT_TO_TOOLS: Record<string, string[]> = (() => {
	const mapping: Record<string, string[]> = {};
	
	for (const tool of tools) {
		const intents = tool.function.intents;
		if (!intents) continue;
		
		for (const intent of intents) {
			if (!mapping[intent]) {
				mapping[intent] = [];
			}
			mapping[intent].push(tool.function.name);
		}
	}
	
	return mapping;
})();

/**
 * Get filtered tools based on the classifier intent.
 * Returns only the tools relevant to the intent, or all tools if no mapping exists.
 */
export function getToolsForIntent(intent: string): ToolSchema[] {
	const allowedTools = INTENT_TO_TOOLS[intent];
	
	// If no mapping, return all tools (fallback)
	if (!allowedTools || allowedTools.length === 0) {
		return toolsForAI;
	}
	
	// Filter to only the allowed tools
	return toolsForAI.filter((tool) => allowedTools.includes(tool.function.name));
}

/**
 * Creates tool schemas with device hash parameters removed.
 * The AI doesn't need to provide hashes - we inject them automatically.
 */
export function getToolsWithoutHash(): ToolSchema[] {
	return tools.map((tool) => {
		// If this tool doesn't need device hash, return as-is
		if (!DEVICE_TOOLS.has(tool.function.name)) {
			return tool;
		}

		// Clone and remove hash params
		const properties = { ...tool.function.parameters.properties };
		const required = tool.function.parameters.required.filter(
			(r) => !DEVICE_HASH_PARAMS.includes(r as typeof DEVICE_HASH_PARAMS[number]),
		);

		for (const hashParam of DEVICE_HASH_PARAMS) {
			delete properties[hashParam];
		}

		return {
			...tool,
			function: {
				...tool.function,
				parameters: {
					...tool.function.parameters,
					properties,
					required,
				},
			},
		};
	});
}

/** Tool schemas for AI (without hash params) */
export const toolsForAI = getToolsWithoutHash();

/**
 * Injects device hash into tool call arguments if the tool requires it.
 * 
 * @param toolName - Name of the tool being called
 * @param args - Original arguments from AI
 * @param deviceHash - The device hash to inject
 * @returns Arguments with hash injected if needed
 */
export function injectDeviceHash(
	toolName: string,
	args: Record<string, unknown>,
	deviceHash: string,
): Record<string, unknown> {
	if (!DEVICE_TOOLS.has(toolName)) {
		return args;
	}

	// Determine which hash param this tool uses
	const toolSchema = tools.find((t) => t.function.name === toolName);
	if (!toolSchema) return args;

	const hashParamName = DEVICE_HASH_PARAMS.find(
		(param) => param in toolSchema.function.parameters.properties,
	);

	if (!hashParamName) return args;

	return {
		...args,
		[hashParamName]: deviceHash,
	};
}

console.log(JSON.stringify(toolsForAI, null, 2));