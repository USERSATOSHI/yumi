import { Singleton } from '@yumi/patterns';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { LogEntry, LoggerConfig, LogLevel, LogMetrics } from './types';
import { COLORS, formatMetrics, LOG_LEVELS, RESET } from './utils';

const DEFAULT_CONFIG: LoggerConfig = {
	level: 'info',
	console: true,
	file: false,
	logDir: './logs',
	colors: true,
};

/**
 * Singleton logger with console/file output and metrics.
 *
 * @example
 * ```ts
 * const logger = Logger.getInstance({ level: 'debug', file: true });
 *
 * logger.info('Server started', { port: 3000 });
 *
 * // With metrics
 * const end = logger.time();
 * await doWork();
 * logger.withMetrics({ duration: end() }).info('Done');
 *
 * // Child logger with context
 * const db = logger.child('database');
 * db.debug('Connected');
 * ```
 */
export class Logger extends Singleton {
	config: LoggerConfig;
	private pendingMetrics?: LogMetrics;

	protected constructor(config: Partial<LoggerConfig> = {}) {
		super();
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/** Create a scoped logger with a fixed context */
	child(context: string): ChildLogger {
		return new ChildLogger(this, context);
	}

	/** Attach metrics to the next log call */
	withMetrics(metrics: LogMetrics): this {
		this.pendingMetrics = metrics;
		return this;
	}

	/** Start a timer, returns a function that gives elapsed ms */
	time(): () => number {
		const start = performance.now();
		return () => Math.round(performance.now() - start);
	}

	/** Start a memory tracker, returns a function that gives heap delta in bytes (can be negative due to GC) */
	memDelta(): () => number {
		const start = process.memoryUsage().heapUsed;
		return () => process.memoryUsage().heapUsed - start;
	}

	/** Get current heap memory in bytes */
	memory(): number {
		return process.memoryUsage().heapUsed;
	}

	debug(message: string, data?: Record<string, unknown>) {
		this.log('debug', message, data);
	}

	info(message: string, data?: Record<string, unknown>) {
		this.log('info', message, data);
	}

	warn(message: string, data?: Record<string, unknown>) {
		this.log('warn', message, data);
	}

	error(message: string, data?: Record<string, unknown>) {
		this.log('error', message, data);
	}

	fatal(message: string, data?: Record<string, unknown>) {
		this.log('fatal', message, data);
	}

	log(level: LogLevel, message: string, data?: Record<string, unknown>, context?: string) {
		if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) return;

		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			message,
			context: context ?? this.config.context,
			data,
			metrics: this.pendingMetrics,
		};

		this.pendingMetrics = undefined;

		if (this.config.console) this.writeToConsole(entry);
		if (this.config.file) this.writeToFile(entry);
	}

	private writeToConsole(entry: LogEntry) {
		const { colors } = this.config;
		const color = colors ? COLORS[entry.level] : '';
		const reset = colors ? RESET : '';

		const parts = [
			`${color}${entry.timestamp}`,
			entry.level.toUpperCase().padEnd(5) + reset,
			entry.context ? `[${entry.context}]` : '',
			entry.message,
			entry.metrics ? formatMetrics(entry.metrics) : '',
			entry.data ? JSON.stringify(entry.data) : '',
		];

		const line = parts.filter(Boolean).join(' ');

		if (entry.level === 'error' || entry.level === 'fatal') {
			console.error(line);
		} else if (entry.level === 'warn') {
			console.warn(line);
		} else {
			console.log(line);
		}
	}

	private async writeToFile(entry: LogEntry) {
		const date = entry.timestamp.split('T')[0];
		const filePath = join(this.config.logDir, `${date}.jsonl`);

		try {
			await mkdir(dirname(filePath), { recursive: true });
			await appendFile(filePath, JSON.stringify(entry) + '\n');
		} catch (err) {
			console.error('Failed to write log:', err);
		}
	}
}

/** A logger scoped to a specific context */
export class ChildLogger {
	private pendingMetrics?: LogMetrics;

	constructor(
		private parent: Logger,
		private context: string
	) {}

	withMetrics(metrics: LogMetrics): this {
		this.pendingMetrics = metrics;
		return this;
	}

	time() {
		return this.parent.time();
	}

	memDelta() {
		return this.parent.memDelta();
	}

	memory() {
		return this.parent.memory();
	}

	debug(message: string, data?: Record<string, unknown>) {
		this.emit('debug', message, data);
	}

	info(message: string, data?: Record<string, unknown>) {
		this.emit('info', message, data);
	}

	warn(message: string, data?: Record<string, unknown>) {
		this.emit('warn', message, data);
	}

	error(message: string, data?: Record<string, unknown>) {
		this.emit('error', message, data);
	}

	fatal(message: string, data?: Record<string, unknown>) {
		this.emit('fatal', message, data);
	}

	private emit(level: LogLevel, message: string, data?: Record<string, unknown>) {
		if (this.pendingMetrics) {
			this.parent.withMetrics(this.pendingMetrics);
			this.pendingMetrics = undefined;
		}
		this.parent.log(level, message, data, this.context);
	}
}
