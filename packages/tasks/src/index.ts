/**
 * @yumi/tasks - Advanced reminders and todos with natural language parsing.
 *
 * This package provides AI-friendly tools for managing reminders and todos
 * with comprehensive natural language support for dates, times, and recurrence patterns.
 *
 * @example
 * ```ts
 * import { getTaskToolSchemas, setTaskStorage, taskTools } from '@yumi/tasks';
 *
 * // Set up storage
 * setTaskStorage(myStorageImplementation);
 *
 * // Get tool schemas for AI
 * const schemas = getTaskToolSchemas();
 *
 * // Use tools directly
 * await taskTools.createReminder({
 *   message: "Pay rent",
 *   remindAt: "today",
 *   repeat: "monthly"
 * });
 * ```
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateToolSchemasFromFile, type ToolSchema } from '@yumi/tools';

// Re-export everything
export * from './types';
export * from './parser';
export {
	taskTools,
	setTaskStorage,
	getTaskStorage,
	createReminder,
	listReminders,
	deleteReminder,
	snoozeReminder,
	completeReminder,
	createTodo,
	listTodos,
	completeTodo,
	deleteTodo,
	updateTodoPriority,
	setTodoDue,
	calculateNextTrigger,
	type TaskToolName,
} from './tools';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Cached tool schemas */
let cachedSchemas: ToolSchema[] | null = null;

/**
 * Generate tool schemas from the task tools.
 * These schemas can be merged with other tools for AI function calling.
 *
 * @returns Array of tool schemas ready for AI consumption.
 *
 * @example
 * ```ts
 * import { getTaskToolSchemas } from '@yumi/tasks';
 * import { toolsForAI } from './your-tools';
 *
 * // Merge task tools with your existing tools
 * const allTools = [...toolsForAI, ...getTaskToolSchemas()];
 * ```
 */
export function getTaskToolSchemas(): ToolSchema[] {
	if (cachedSchemas) {
		return cachedSchemas;
	}

	const result = generateToolSchemasFromFile(resolve(__dirname, 'tools.ts'));
	if (result.isErr()) {
		console.error('Failed to generate task tool schemas:', result.unwrapErr());
		return [];
	}

	cachedSchemas = result.unwrap() ?? [];
	return cachedSchemas ?? [];
}

/**
 * Get tool schemas filtered by intent.
 *
 * @param intent - The intent to filter by (e.g., 'REMINDER_ADD', 'TODO_LIST')
 * @returns Filtered array of tool schemas
 */
export function getTaskToolsForIntent(intent: string): ToolSchema[] {
	const schemas = getTaskToolSchemas();
	return schemas.filter((schema) => schema.function.intents?.includes(intent));
}

/**
 * Build intent-to-tools mapping from task tool schemas.
 *
 * @returns Record mapping intents to tool names
 */
export function getTaskIntentMapping(): Record<string, string[]> {
	const schemas = getTaskToolSchemas();
	const mapping: Record<string, string[]> = {};

	for (const schema of schemas) {
		const intents = schema.function.intents;
		if (!intents) continue;

		for (const intent of intents) {
			if (!mapping[intent]) {
				mapping[intent] = [];
			}
			mapping[intent].push(schema.function.name);
		}
	}

	return mapping;
}
