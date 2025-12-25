import type { LogLevel, LogMetrics } from './types';

export const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
	fatal: 4,
};

export const COLORS: Record<LogLevel, string> = {
	debug: '\x1b[90m', // gray
	info: '\x1b[36m', // cyan
	warn: '\x1b[33m', // yellow
	error: '\x1b[31m', // red
	fatal: '\x1b[35m', // magenta
};

export const RESET = '\x1b[0m';

/** Format metrics for console output */
export function formatMetrics(metrics: LogMetrics): string {
	const parts: string[] = [];

	for (const [key, value] of Object.entries(metrics)) {
		if (value === undefined) continue;

		if (key === 'duration') {
			parts.push(`${value}ms`);
		} else if (key === 'memory') {
			parts.push(`${(value / 1024 / 1024).toFixed(1)}MB`);
		} else {
			parts.push(`${key}=${value}`);
		}
	}

	return parts.length ? `[${parts.join(' ')}]` : '';
}

/** Access nested object properties using dot notation (e.g. "data.user.id") */
export function getNestedValue(obj: unknown, path: string): unknown {
	let current = obj;

	for (const key of path.split('.')) {
		if (current == null) return undefined;
		current = (current as Record<string, unknown>)[key];
	}

	return current;
}
