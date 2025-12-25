import type { LogEntry, LogLevel } from './types';

/**
 * Parse and stream JSONL log files.
 *
 * @example
 * ```ts
 * // Parse a file
 * const logs = await LogParser.parseFile('./logs/2024-01-01.jsonl');
 *
 * // Tail logs in real-time
 * for await (const entry of LogParser.tail('./logs/today.jsonl')) {
 *   console.log('New:', entry.message);
 * }
 * ```
 */
export class LogParser {
	/** Parse a single JSON line */
	static parseLine(line: string): LogEntry | null {
		try {
			return JSON.parse(line) as LogEntry;
		} catch {
			return null;
		}
	}

	/** Parse an entire JSONL file */
	static async parseFile(filePath: string): Promise<LogEntry[]> {
		const file = Bun.file(filePath);
		const text = await file.text();

		return text
			.split('\n')
			.filter(Boolean)
			.map((line) => this.parseLine(line))
			.filter((entry): entry is LogEntry => entry !== null);
	}

	/** Stream new entries as they're written (like tail -f) */
	static async *tail(filePath: string): AsyncGenerator<LogEntry> {
		const file = Bun.file(filePath);
		let position = (await file.exists()) ? file.size : 0;

		while (true) {
			const currentSize = Bun.file(filePath).size;

			if (currentSize > position) {
				const text = await file.slice(position, currentSize).text();
				position = currentSize;

				for (const line of text.split('\n').filter(Boolean)) {
					const entry = this.parseLine(line);
					if (entry) yield entry;
				}
			}

			await Bun.sleep(100);
		}
	}

	/** Simple filter helper */
	static filter(
		entries: LogEntry[],
		criteria: {
			level?: LogLevel | LogLevel[];
			context?: string;
			from?: Date;
			to?: Date;
			search?: string;
		}
	): LogEntry[] {
		return entries.filter((entry) => {
			// Level filter
			if (criteria.level) {
				const levels = Array.isArray(criteria.level) ? criteria.level : [criteria.level];
				if (!levels.includes(entry.level)) return false;
			}

			// Context filter
			if (criteria.context && entry.context !== criteria.context) return false;

			// Date range filter
			const timestamp = new Date(entry.timestamp);
			if (criteria.from && timestamp < criteria.from) return false;
			if (criteria.to && timestamp > criteria.to) return false;

			// Text search
			if (criteria.search) {
				const search = criteria.search.toLowerCase();
				const inMessage = entry.message.toLowerCase().includes(search);
				const inData = entry.data && JSON.stringify(entry.data).toLowerCase().includes(search);
				if (!inMessage && !inData) return false;
			}

			return true;
		});
	}

	/** Aggregate duration metrics */
	static aggregateMetrics(entries: LogEntry[]) {
		const durations = entries
			.map((e) => e.metrics?.duration)
			.filter((d): d is number => d !== undefined);

		if (!durations.length) {
			return { count: entries.length };
		}

		const sum = durations.reduce((a, b) => a + b, 0);

		return {
			count: entries.length,
			avgDuration: sum / durations.length,
			minDuration: Math.min(...durations),
			maxDuration: Math.max(...durations),
			totalDuration: sum,
		};
	}
}
