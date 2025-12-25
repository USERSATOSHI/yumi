import { safe } from '@yumi/results';
import { statDB } from '../db/index.js';
import * as tools from '../tools/tools.js';

type AsyncFunction = (...args: unknown[]) => Promise<unknown>;

export async function executeCommand(
	name: string,
	args: Record<string, unknown> | unknown[],
	deviceHash: string = 'server',
): Promise<{ success: boolean; result: unknown }> {
	const fn = tools[name as keyof typeof tools] as AsyncFunction;
	if (!fn) {
		statDB.recordCommand(name, deviceHash, false, 0);
		return { success: false, result: null };
	}

	const start = Date.now();
	const argsArray = Array.isArray(args) ? args : Object.values(args || {});
	const res = await safe(fn, ...argsArray);
	const duration = Date.now() - start;

	const success = res.isOk();
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
