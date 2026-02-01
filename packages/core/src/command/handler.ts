import { safe } from '@yumi/results';
import { statDB } from '../db/index.js';
import * as coreTools from '../tools/tools.js';
import * as taskTools from '@yumi/tasks';
import type Elysia from 'elysia';
import type { ElysiaWS } from 'elysia/ws';

type AsyncFunction = (args: any) => Promise<unknown> | unknown;

// Merged tools registry - core + tasks
const tools: Record<string, AsyncFunction> = {
	...coreTools,
	// Only include the actual tool functions from @yumi/tasks (not utility functions)
	createReminder: taskTools.createReminder,
	listReminders: taskTools.listReminders,
	deleteReminder: taskTools.deleteReminder,
	snoozeReminder: taskTools.snoozeReminder,
	completeReminder: taskTools.completeReminder,
	createTodo: taskTools.createTodo,
	listTodos: taskTools.listTodos,
	completeTodo: taskTools.completeTodo,
	deleteTodo: taskTools.deleteTodo,
	updateTodoPriority: taskTools.updateTodoPriority,
	setTodoDue: taskTools.setTodoDue,
}

export async function executeCommand(
	name: string,
	args: Record<string, unknown> | unknown[],
	deviceHash: string = 'server',
	ws: ElysiaWS | null = null,
): Promise<{ success: boolean; result: unknown }> {
	let fn = tools[name] as AsyncFunction;
	if (!fn) {
		console.error(`[executeCommand] Tool not found: ${name}`);
		statDB.recordCommand(name, deviceHash, false, 0);
		return { success: false, result: null };
	}

	console.debug(`[executeCommand] Executing tool: ${name}`, { args, deviceHash });

	const start = Date.now();
	fn = fn.bind(ws ?? null);
	
	// Call the function and await if it returns a Promise
	const res = await safe(fn(args) as Promise<unknown>);
	const duration = Date.now() - start;

	const success = res.isOk();
	
	if (!success) {
		console.error(`[executeCommand] Tool ${name} failed:`, res.unwrapErr());
	} else {
		console.debug(`[executeCommand] Tool ${name} succeeded:`, res.unwrap());
	}
	
	statDB.recordCommand(name, deviceHash, success, duration);

	return {
		success,
		result: success ? res.unwrap() : null,
	};
}

export function relayCommand(
	name: string,
	fromDevice: string,
	toDevice: string,
): void {
	statDB.recordCommand(`relay:${name}`, fromDevice, true, 0);
}
