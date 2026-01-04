import { Singleton } from '@yumi/patterns';
import { Result } from '@yumi/results';
import { coreDB, CoreDB } from '../../db/index.js';
import { ReminderPoolError } from './error.js';

export type Reminder = {
	id: number;
	title: string;
	description: string | null;
	remindAt: number;
	repeat: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
	completed: boolean;
	createdAt: number;
	updatedAt: number;
};

export type ReminderCallback = (reminder: Reminder) => void | Promise<void>;

export interface ReminderPoolOptions {
	sweepInterval?: number; // How often to check for due reminders (ms)
	onReminder?: ReminderCallback; // Callback when reminder is due
}

export class ReminderPool extends Singleton {
	#db: CoreDB = coreDB
	#timers: Map<number, Timer> = new Map(); // id -> timer
	#titleToId: Map<string, number> = new Map(); // title -> id (for AI lookup)
	#sweepInterval: Timer | null = null;
	#onReminder: ReminderCallback | null = null;
	#clearCompletedInterval: number = 24 * 60 * 60 * 1000; // 24 hours

	constructor(options: ReminderPoolOptions = {}) {
		super();
		this.#onReminder = options.onReminder ?? null;

		// Load existing reminders into memory
		this.#syncFromDB();

		// Start sweeper
		const interval = options.sweepInterval ?? 60_000; // Default 1 minute
		this.#startSweeper(interval);
	}

	/**
	 * Set the callback to be called when a reminder is due.
	 * This allows setting the callback after initialization (useful for avoiding circular imports).
	 */
	setOnReminder(callback: ReminderCallback | null): void {
		this.#onReminder = callback;
	}

	#syncFromDB() {
		const reminders = this.#db.getUpcomingReminders(1000);
		for (const row of reminders) {
			const reminder = this.#rowToReminder(row);
			this.#titleToId.set(reminder.title.toLowerCase(), reminder.id);
			this.#scheduleTimer(reminder);
		}
	}

	#rowToReminder(row: {
		id: number;
		title: string;
		description: string | null;
		remind_at: number;
		repeat: string | null;
		completed: number;
		created_at: number;
		updated_at: number;
	}): Reminder {
		return {
			id: row.id,
			title: row.title,
			description: row.description,
			remindAt: row.remind_at,
			repeat: row.repeat as Reminder['repeat'],
			completed: row.completed === 1,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	#scheduleTimer(reminder: Reminder) {
		// Clear existing timer if any
		this.#clearTimer(reminder.id);

		const delay = reminder.remindAt - Date.now();
		if (delay <= 0) return; // Already due, sweeper will handle

		const timer = setTimeout(() => {
			this.#handleDueReminder(reminder.id);
		}, delay);

		this.#timers.set(reminder.id, timer);
	}

	#clearTimer(id: number) {
		const timer = this.#timers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.#timers.delete(id);
		}
	}

	async #handleDueReminder(id: number) {
		const row = this.#db.getReminder(id);

		if (!row) return;

		if (row.completed) {
			// check if this reminder fits the clean up criteria
			const now = Date.now();
			if (now - row.updated_at >= this.#clearCompletedInterval) {
				// delete the reminder
				this.#db.deleteReminder(id);
				this.#clearTimer(id);
				this.#titleToId.forEach((reminderId, title) => {
					if (reminderId === id) {
						this.#titleToId.delete(title);
					}
				});
			}
			return;
		}

		const reminder = this.#rowToReminder(row);

		// Trigger callback
		if (this.#onReminder) {
			try {
				await this.#onReminder(reminder);
			} catch (e) {
				console.error('Reminder callback failed:', e);
			}
		}

		// Complete (or reschedule if repeating)
		this.#db.completeReminder(id);

		// If repeating, reschedule
		if (reminder.repeat) {
			const updated = this.#db.getReminder(id);
			if (updated) {
				this.#scheduleTimer(this.#rowToReminder(updated));
			}
		} else {
			this.#timers.delete(id);
		}
	}

	#startSweeper(interval: number) {
		this.#sweepInterval = setInterval(() => {
			this.sweep();
		}, interval);
	}

	// ─── Public API (AI-friendly, uses titles) ───────────────────────────────

	/**
	 * Add a new reminder
	 */
	add(
		title: string,
		remindAt: number | Date,
		options: { description?: string; repeat?: 'daily' | 'weekly' | 'monthly' | 'yearly' } = {}
	): Result<Reminder, ReminderPoolError> {
		const normalizedTitle = title.toLowerCase();
		
		if (this.#titleToId.has(normalizedTitle)) {
			return Result.err(ReminderPoolError.ReminderAlreadyExists);
		}

		const remindAtMs = remindAt instanceof Date ? remindAt.getTime() : remindAt;
		if (remindAtMs <= Date.now()) {
			return Result.err(ReminderPoolError.InvalidRemindTime);
		}

		const id = this.#db.addReminder(title, remindAtMs, options);
		const row = this.#db.getReminder(id);
		if (!row) {
			return Result.err(ReminderPoolError.ReminderNotFound);
		}

		const reminder = this.#rowToReminder(row);
		this.#titleToId.set(normalizedTitle, id);
		this.#scheduleTimer(reminder);

		return Result.ok(reminder);
	}

	/**
	 * Get a reminder by title (for AI)
	 */
	get(title: string): Result<Reminder, ReminderPoolError> {
		const id = this.#titleToId.get(title.toLowerCase());
		if (!id) {
			return Result.err(ReminderPoolError.ReminderNotFound);
		}

		const row = this.#db.getReminder(id);
		if (!row) {
			this.#titleToId.delete(title.toLowerCase());
			return Result.err(ReminderPoolError.ReminderNotFound);
		}

		return Result.ok(this.#rowToReminder(row));
	}

	/**
	 * Complete/dismiss a reminder by title
	 */
	complete(title: string): Result<boolean, ReminderPoolError> {
		const id = this.#titleToId.get(title.toLowerCase());
		if (!id) {
			return Result.err(ReminderPoolError.ReminderNotFound);
		}

		const success = this.#db.completeReminder(id);
		if (success) {
			const row = this.#db.getReminder(id);
			if (row?.repeat) {
				// Reschedule repeating reminder
				this.#scheduleTimer(this.#rowToReminder(row));
			} else {
				this.#clearTimer(id);
				this.#titleToId.delete(title.toLowerCase());
			}
		}

		return Result.ok(success);
	}

	/**
	 * Delete a reminder by title
	 */
	delete(title: string): Result<boolean, ReminderPoolError> {
		const id = this.#titleToId.get(title.toLowerCase());
		if (!id) {
			return Result.err(ReminderPoolError.ReminderNotFound);
		}

		const success = this.#db.deleteReminder(id);
		if (success) {
			this.#clearTimer(id);
			this.#titleToId.delete(title.toLowerCase());
		}

		return Result.ok(success);
	}

	/**
	 * List all upcoming reminders
	 */
	list(limit: number = 10): Reminder[] {
		return this.#db.getUpcomingReminders(limit).map((row) => this.#rowToReminder(row));
	}

	/**
	 * Get reminders that are currently due
	 */
	getDue(): Reminder[] {
		return this.#db.getDueReminders().map((row) => this.#rowToReminder(row));
	}

	/**
	 * Find reminders by partial title match (for AI fuzzy lookup)
	 */
	find(query: string): Reminder[] {
		const q = query.toLowerCase();
		const matches: Reminder[] = [];

		for (const [title, id] of this.#titleToId) {
			if (title.includes(q)) {
				const row = this.#db.getReminder(id);
				if (row) matches.push(this.#rowToReminder(row));
			}
		}

		return matches;
	}

	/**
	 * Check if a reminder exists by title
	 */
	has(title: string): boolean {
		return this.#titleToId.has(title.toLowerCase());
	}

	/**
	 * Sweep: process due reminders and clean up
	 */
	sweep(): number {
		const due = this.#db.getDueReminders();
		let processed = 0;

		for (const row of due) {
			this.#handleDueReminder(row.id);
			processed++;
		}

		return processed;
	}

	/**
	 * Set the reminder callback
	 */
	onReminder(callback: ReminderCallback) {
		this.#onReminder = callback;
	}

	/**
	 * Get count of active reminders
	 */
	get count(): number {
		return this.#titleToId.size;
	}

	/**
	 * Get count of scheduled timers
	 */
	get timerCount(): number {
		return this.#timers.size;
	}

	/**
	 * Stop the sweeper and clear all timers
	 */
	destroy() {
		if (this.#sweepInterval) {
			clearInterval(this.#sweepInterval);
			this.#sweepInterval = null;
		}

		for (const timer of this.#timers.values()) {
			clearTimeout(timer);
		}
		this.#timers.clear();
		this.#titleToId.clear();
	}
}

export const reminderPool = ReminderPool.getInstance();
