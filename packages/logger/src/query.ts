import { join } from 'node:path';

import { LogParser } from './parser';
import type { LogEntry, LogLevel } from './types';
import { getNestedValue } from './utils';

type CompareOp = '>' | '<' | '>=' | '<=' | '=' | '!=';

/**
 * Query logs with a fluent API.
 *
 * @example
 * ```ts
 * const query = new LogQuery('./logs');
 *
 * // Find slow requests
 * const slow = await query
 *   .lastHours(1)
 *   .where('context', 'http')
 *   .whereMetric('duration', '>', 100)
 *   .orderBy('metrics.duration', 'desc')
 *   .limit(10)
 *   .execute();
 *
 * // Count errors by context
 * const counts = await query
 *   .where('level', 'error')
 *   .groupBy('context')
 *   .count();
 *
 * // Search logs
 * const matches = await query
 *   .search('connection failed')
 *   .execute();
 * ```
 */
export class LogQuery {
	private filters: Array<(entry: LogEntry) => boolean> = [];
	private fromDate?: Date;
	private toDate?: Date;
	private sortKey?: string;
	private sortOrder: 'asc' | 'desc' = 'asc';
	private limitCount?: number;
	private offsetCount = 0;
	private groupByKey?: string;

	constructor(private logDir: string) {}

	// ─── Date Filters ────────────────────────────────────────────────────────

	from(date: Date): this {
		this.fromDate = date;
		return this;
	}

	to(date: Date): this {
		this.toDate = date;
		return this;
	}

	today(): this {
		const now = new Date();
		this.fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		this.toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
		return this;
	}

	lastMinutes(n: number): this {
		this.fromDate = new Date(Date.now() - n * 60 * 1000);
		return this;
	}

	lastHours(n: number): this {
		this.fromDate = new Date(Date.now() - n * 60 * 60 * 1000);
		return this;
	}

	// ─── Field Filters ───────────────────────────────────────────────────────

	where<K extends keyof LogEntry>(
		key: K,
		value: LogEntry[K] | LogEntry[K][] | ((val: LogEntry[K]) => boolean)
	): this {
		this.filters.push((entry) => {
			const entryValue = entry[key];

			if (typeof value === 'function') {
				return (value as (val: LogEntry[K]) => boolean)(entryValue);
			}
			if (Array.isArray(value)) {
				return value.includes(entryValue);
			}
			return entryValue === value;
		});
		return this;
	}

	whereData(key: string, value: unknown | ((val: unknown) => boolean)): this {
		this.filters.push((entry) => {
			const entryValue = getNestedValue(entry.data, key);

			if (typeof value === 'function') {
				return (value as (val: unknown) => boolean)(entryValue);
			}
			return entryValue === value;
		});
		return this;
	}

	whereMetric(key: string, op: CompareOp, value: number): this {
		this.filters.push((entry) => {
			const metric = entry.metrics?.[key];
			if (metric === undefined) return false;

			switch (op) {
				case '>':
					return metric > value;
				case '<':
					return metric < value;
				case '>=':
					return metric >= value;
				case '<=':
					return metric <= value;
				case '=':
					return metric === value;
				case '!=':
					return metric !== value;
			}
		});
		return this;
	}

	// ─── Text Search ─────────────────────────────────────────────────────────

	search(text: string, caseSensitive = false): this {
		const needle = caseSensitive ? text : text.toLowerCase();

		this.filters.push((entry) => {
			const message = caseSensitive ? entry.message : entry.message.toLowerCase();
			if (message.includes(needle)) return true;

			if (entry.data) {
				const dataStr = caseSensitive
					? JSON.stringify(entry.data)
					: JSON.stringify(entry.data).toLowerCase();
				if (dataStr.includes(needle)) return true;
			}

			return false;
		});
		return this;
	}

	match(pattern: RegExp): this {
		this.filters.push((entry) => {
			if (pattern.test(entry.message)) return true;
			if (entry.data && pattern.test(JSON.stringify(entry.data))) return true;
			return false;
		});
		return this;
	}

	// ─── Sorting & Pagination ────────────────────────────────────────────────

	orderBy(key: string, order: 'asc' | 'desc' = 'asc'): this {
		this.sortKey = key;
		this.sortOrder = order;
		return this;
	}

	limit(count: number): this {
		this.limitCount = count;
		return this;
	}

	offset(count: number): this {
		this.offsetCount = count;
		return this;
	}

	// ─── Grouping ────────────────────────────────────────────────────────────

	groupBy(key: string): this {
		this.groupByKey = key;
		return this;
	}

	// ─── Execution ───────────────────────────────────────────────────────────

	async execute(): Promise<LogEntry[]> {
		let results = await this.loadAndFilter();

		if (this.sortKey) {
			results = this.sort(results);
		}

		if (this.offsetCount > 0) {
			results = results.slice(this.offsetCount);
		}

		if (this.limitCount !== undefined) {
			results = results.slice(0, this.limitCount);
		}

		this.reset();
		return results;
	}

	async first(): Promise<LogEntry | null> {
		this.limitCount = 1;
		const results = await this.loadAndFilter();
		this.reset();
		return results[0] ?? null;
	}

	async last(): Promise<LogEntry | null> {
		const results = await this.loadAndFilter();
		this.reset();
		return results[results.length - 1] ?? null;
	}

	async exists(): Promise<boolean> {
		this.limitCount = 1;
		const results = await this.loadAndFilter();
		this.reset();
		return results.length > 0;
	}

	// ─── Aggregations ────────────────────────────────────────────────────────

	async count(): Promise<number | Record<string, number>> {
		const results = await this.loadAndFilter();
		const groupKey = this.groupByKey;
		this.reset();

		if (groupKey) {
			return this.aggregateWith(results, groupKey, () => 1, (vals) => vals.length);
		}

		return results.length;
	}

	async sum(key: string): Promise<number | Record<string, number>> {
		const results = await this.loadAndFilter();
		const groupKey = this.groupByKey;
		this.reset();
		const extract = (entry: LogEntry) => getNestedValue(entry, key) as number | undefined;

		if (groupKey) {
			return this.aggregateWith(results, groupKey, extract, this.sumNumbers);
		}

		return this.sumNumbers(results.map(extract));
	}

	async avg(key: string): Promise<number | Record<string, number>> {
		const results = await this.loadAndFilter();
		const groupKey = this.groupByKey;
		this.reset();
		const extract = (entry: LogEntry) => getNestedValue(entry, key) as number | undefined;

		if (groupKey) {
			return this.aggregateWith(results, groupKey, extract, this.avgNumbers);
		}

		return this.avgNumbers(results.map(extract));
	}

	async min(key: string): Promise<number | Record<string, number>> {
		const results = await this.loadAndFilter();
		const groupKey = this.groupByKey;
		this.reset();
		const extract = (entry: LogEntry) => getNestedValue(entry, key) as number | undefined;

		if (groupKey) {
			return this.aggregateWith(results, groupKey, extract, this.minNumber);
		}

		return this.minNumber(results.map(extract));
	}

	async max(key: string): Promise<number | Record<string, number>> {
		const results = await this.loadAndFilter();
		const groupKey = this.groupByKey;
		this.reset();
		const extract = (entry: LogEntry) => getNestedValue(entry, key) as number | undefined;

		if (groupKey) {
			return this.aggregateWith(results, groupKey, extract, this.maxNumber);
		}

		return this.maxNumber(results.map(extract));
	}

	async distinctValues<T = unknown>(key: string): Promise<T[]> {
		const results = await this.loadAndFilter();
		this.reset();
		const values = new Set<T>();

		for (const entry of results) {
			const val = getNestedValue(entry, key) as T;
			if (val !== undefined) values.add(val);
		}

		return Array.from(values);
	}

	async toMap(key: string): Promise<Map<string, LogEntry[]>> {
		const entries = await this.execute();
		const map = new Map<string, LogEntry[]>();

		for (const entry of entries) {
			const groupKey = String(getNestedValue(entry, key) ?? 'undefined');
			if (!map.has(groupKey)) map.set(groupKey, []);
			map.get(groupKey)!.push(entry);
		}

		return map;
	}

	// ─── Reset ───────────────────────────────────────────────────────────────

	reset(): this {
		this.filters = [];
		this.fromDate = undefined;
		this.toDate = undefined;
		this.sortKey = undefined;
		this.sortOrder = 'asc';
		this.limitCount = undefined;
		this.offsetCount = 0;
		this.groupByKey = undefined;
		return this;
	}

	// ─── Private Helpers ─────────────────────────────────────────────────────

	private async loadAndFilter(): Promise<LogEntry[]> {
		const files = await this.getLogFiles();
		const allEntries: LogEntry[] = [];

		for (const file of files) {
			const entries = await LogParser.parseFile(file);
			allEntries.push(...entries);
		}

		return allEntries.filter((entry) => {
			const timestamp = new Date(entry.timestamp);
			if (this.fromDate && timestamp < this.fromDate) return false;
			if (this.toDate && timestamp > this.toDate) return false;
			return this.filters.every((fn) => fn(entry));
		});
	}

	private async getLogFiles(): Promise<string[]> {
		const glob = new Bun.Glob('*.jsonl');
		const files: string[] = [];

		for await (const file of glob.scan(this.logDir)) {
			const filePath = join(this.logDir, file);

			if (this.fromDate || this.toDate) {
				const match = file.match(/(\d{4}-\d{2}-\d{2})/);
				if (match?.[1]) {
					const fileDate = new Date(match[1]);
					if (this.fromDate && fileDate < new Date(this.fromDate.toDateString())) continue;
					if (this.toDate && fileDate > new Date(this.toDate.toDateString())) continue;
				}
			}

			files.push(filePath);
		}

		return files.sort();
	}

	private sort(entries: LogEntry[]): LogEntry[] {
		const key = this.sortKey!;

		return [...entries].sort((a, b) => {
			const aVal = getNestedValue(a, key);
			const bVal = getNestedValue(b, key);

			let result = 0;
			if (aVal === bVal) result = 0;
			else if (aVal == null) result = 1;
			else if (bVal == null) result = -1;
			else if (aVal < bVal) result = -1;
			else result = 1;

			return this.sortOrder === 'desc' ? -result : result;
		});
	}

	private aggregateWith<T, R>(
		entries: LogEntry[],
		groupKey: string,
		extract: (entry: LogEntry) => T,
		reduce: (values: T[]) => R
	): Record<string, R> {
		const groups = new Map<string, T[]>();

		for (const entry of entries) {
			const key = String(getNestedValue(entry, groupKey) ?? 'undefined');
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(extract(entry));
		}

		const result: Record<string, R> = {};
		for (const [key, values] of groups) {
			result[key] = reduce(values);
		}
		return result;
	}

	private sumNumbers(values: (number | undefined)[]): number {
		return values.filter((v): v is number => v !== undefined).reduce((a, b) => a + b, 0);
	}

	private avgNumbers(values: (number | undefined)[]): number {
		const nums = values.filter((v): v is number => v !== undefined);
		return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
	}

	private minNumber(values: (number | undefined)[]): number {
		const nums = values.filter((v): v is number => v !== undefined);
		return nums.length ? Math.min(...nums) : 0;
	}

	private maxNumber(values: (number | undefined)[]): number {
		const nums = values.filter((v): v is number => v !== undefined);
		return nums.length ? Math.max(...nums) : 0;
	}
}
