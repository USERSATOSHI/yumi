export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	context?: string;
	data?: Record<string, unknown>;
	metrics?: LogMetrics;
}

export interface LogMetrics {
	/** Time taken in ms */
	duration?: number;
	/** Memory in bytes */
	memory?: number;
	/** Custom metrics */
	[key: string]: number | undefined;
}

export interface LoggerConfig {
	/** Minimum level to log */
	level: LogLevel;
	/** Log to console */
	console: boolean;
	/** Log to file */
	file: boolean;
	/** Directory for log files */
	logDir: string;
	/** Colorize console output */
	colors: boolean;
	/** Default context for all logs */
	context?: string;
}
