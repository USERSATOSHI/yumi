/**
 * AI Tool definitions for tasks (reminders and todos).
 *
 * These functions are designed to be parsed by @yumi/tools to generate
 * tool schemas for AI model function calling. Each function has comprehensive
 * JSDoc documentation with @intent tags and multiple examples.
 */

import {
	parseDateTime,
	parseRecurrence,
	formatRecurrence,
	type ParsedRecurrence,
} from './parser';
import type {
	TaskStorage,
	Reminder,
	Todo,
	Priority,
	TaskStatus,
	TaskOperationResult,
	Recurrence,
} from './types';

/** Storage instance - must be set before using tools */
let storage: TaskStorage | null = null;

/**
 * Set the storage implementation for tasks.
 *
 * @param storageImpl - Storage implementation
 */
export function setTaskStorage(storageImpl: TaskStorage): void {
	storage = storageImpl;
}

/**
 * Get the current storage instance.
 *
 * @returns Storage instance or null
 */
export function getTaskStorage(): TaskStorage | null {
	return storage;
}

function ensureStorage(): TaskStorage {
	if (!storage) {
		console.error('[tasks] ensureStorage: storage not configured');
		throw new Error('Task storage not configured. Call setTaskStorage() first.');
	}
	console.debug('[tasks] ensureStorage: returning storage');
	return storage;
}

/**
 * Convert ParsedRecurrence to Recurrence type.
 */
function toRecurrence(parsed: ParsedRecurrence): Recurrence | undefined {
	if (parsed.type === 'custom') {
		// Custom patterns with daysOfWeek become weekly
		if (parsed.daysOfWeek?.length) {
			return {
				type: 'weekly',
				interval: parsed.interval,
				daysOfWeek: parsed.daysOfWeek,
				endAt: parsed.endDate?.getTime(),
				maxOccurrences: parsed.occurrences,
			};
		}
		// Otherwise treat as daily
		return {
			type: 'daily',
			interval: parsed.interval,
			endAt: parsed.endDate?.getTime(),
			maxOccurrences: parsed.occurrences,
		};
	}
	
	return {
		type: parsed.type,
		interval: parsed.interval,
		daysOfWeek: parsed.daysOfWeek,
		dayOfMonth: parsed.dayOfMonth,
		monthOfYear: parsed.monthOfYear,
		endAt: parsed.endDate?.getTime(),
		maxOccurrences: parsed.occurrences,
	};
}

/**
 * Calculate the next trigger time based on recurrence.
 * This should be called after a reminder triggers to schedule the next occurrence.
 * 
 * @param currentTrigger - The current trigger timestamp
 * @param recurrence - The recurrence configuration
 * @returns Next trigger timestamp, or undefined if no more occurrences
 */
export function calculateNextTrigger(
	currentTrigger: number,
	recurrence: Recurrence,
	triggerCount?: number
): number | undefined {
	// Check if we've hit max occurrences
	if (recurrence.maxOccurrences && triggerCount && triggerCount >= recurrence.maxOccurrences) {
		return undefined;
	}

	const current = new Date(currentTrigger);
	const interval = recurrence.interval || 1;

	switch (recurrence.type) {
		case 'daily': {
			const next = new Date(current);
			next.setDate(next.getDate() + interval);
			const nextTs = next.getTime();
			return recurrence.endAt && nextTs > recurrence.endAt ? undefined : nextTs;
		}

		case 'weekly': {
			if (recurrence.daysOfWeek?.length) {
				// Find next matching day of week
				const sortedDays = [...recurrence.daysOfWeek].sort((a, b) => a - b);
				const currentDay = current.getDay();
				
				// Find next day in current week
				let nextDay = sortedDays.find(d => d > currentDay);
				const next = new Date(current);
				
				if (nextDay !== undefined) {
					// Same week
					next.setDate(next.getDate() + (nextDay - currentDay));
				} else {
					// Next week cycle (+ interval weeks)
					const daysUntilFirst = (7 - currentDay) + sortedDays[0]! + (interval - 1) * 7;
					next.setDate(next.getDate() + daysUntilFirst);
				}
				
				const nextTs = next.getTime();
				return recurrence.endAt && nextTs > recurrence.endAt ? undefined : nextTs;
			}
			
			// Simple weekly
			const next = new Date(current);
			next.setDate(next.getDate() + 7 * interval);
			const nextTs = next.getTime();
			return recurrence.endAt && nextTs > recurrence.endAt ? undefined : nextTs;
		}

		case 'monthly': {
			const next = new Date(current);
			next.setMonth(next.getMonth() + interval);
			
			// Handle specific day of month
			if (recurrence.dayOfMonth) {
				const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
				next.setDate(Math.min(recurrence.dayOfMonth, maxDay));
			}
			
			const nextTs = next.getTime();
			return recurrence.endAt && nextTs > recurrence.endAt ? undefined : nextTs;
		}

		case 'yearly': {
			const next = new Date(current);
			next.setFullYear(next.getFullYear() + interval);
			
			// Handle specific month and day
			if (recurrence.monthOfYear) {
				next.setMonth(recurrence.monthOfYear - 1); // monthOfYear is 1-12
			}
			if (recurrence.dayOfMonth) {
				const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
				next.setDate(Math.min(recurrence.dayOfMonth, maxDay));
			}
			
			const nextTs = next.getTime();
			return recurrence.endAt && nextTs > recurrence.endAt ? undefined : nextTs;
		}

		default:
			return undefined;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// REMINDER TOOLS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a reminder with optional recurrence. Use this to set reminders for tasks, events, or anything the user wants to be reminded about.
 *
 * @intent REMINDER_ADD
 * @intent REMINDER_CREATE
 * @intent REMINDER_SET
 * @param params.message - What to remind about. Extract the core task from user's request.
 * @param params.remindAt - When to remind. Accepts natural language: 'today', 'tomorrow', 'next Monday', '3pm', 'tomorrow at 15:00', 'in 2 hours'. Use 'today' or 'now' for reminders starting immediately.
 * @param params.repeat - How often to repeat. Use 'daily' for every day, 'weekly' for every week, 'monthly' for every month, 'yearly' for every year. Can also use 'every Monday', 'every 2 weeks', 'every 15th'. Leave empty for one-time reminders. IMPORTANT: Match user's words exactly - 'every month' or 'monthly' means 'monthly', 'every day' or 'daily' means 'daily'.
 * @param params.description - Additional notes or context (optional).
 * @returns string - Confirmation message with reminder details.
 *
 * @example
 * ```ts
 * // One-time reminder today
 * createReminder({ message: "Call mom", remindAt: "today at 5pm" });
 *
 * // One-time reminder tomorrow morning
 * createReminder({ message: "Submit report", remindAt: "tomorrow at 9am" });
 *
 * // Daily reminder (e.g., "remind me to take medicine every day")
 * createReminder({ message: "Take medicine", remindAt: "today at 8am", repeat: "daily" });
 *
 * // Weekly reminder (e.g., "remind me about team meeting every week")
 * createReminder({ message: "Team standup", remindAt: "Monday at 10am", repeat: "weekly" });
 *
 * // Monthly reminder (e.g., "remind me to pay rent every month" or "monthly reminder to pay bills")
 * createReminder({ message: "Pay rent", remindAt: "today", repeat: "monthly" });
 *
 * // Monthly reminder starting today (e.g., "add reminder to transfer money every month starting today")
 * createReminder({ message: "Transfer money to post office", remindAt: "today", repeat: "monthly" });
 *
 * // Yearly reminder (e.g., "remind me about mom's birthday every year")
 * createReminder({ message: "Mom's birthday", remindAt: "March 15 at 9am", repeat: "yearly" });
 *
 * // Custom weekly pattern (e.g., "remind me every Monday and Wednesday")
 * createReminder({ message: "Gym day", remindAt: "today at 6pm", repeat: "every Monday and Wednesday" });
 *
 * // Every two weeks
 * createReminder({ message: "Paycheck review", remindAt: "Friday at 5pm", repeat: "every 2 weeks" });
 * ```
 */
export async function createReminder({
	message,
	remindAt,
	repeat,
	description,
}: {
	message: string;
	remindAt: string;
	repeat?: string;
	description?: string;
}): Promise<string> {
	const store = ensureStorage();

	// Parse recurrence if provided (do this before date parsing so parser can consider recurrence)
	let recurrence: Recurrence | undefined = undefined;
	let parsedRecurrence: ParsedRecurrence | null = null;
	if (repeat) {
		parsedRecurrence = parseRecurrence(repeat);
		if (!parsedRecurrence) {
			// Try simple mapping for common words
			const simpleMap: Record<string, ParsedRecurrence> = {
				daily: { type: 'daily', interval: 1 },
				weekly: { type: 'weekly', interval: 1 },
				monthly: { type: 'monthly', interval: 1 },
				yearly: { type: 'yearly', interval: 1 },
				annually: { type: 'yearly', interval: 1 },
			};
			parsedRecurrence = simpleMap[repeat.toLowerCase()] ?? null;

			if (!parsedRecurrence) {
				return `Could not understand the repeat pattern "${repeat}". Try "daily", "weekly", "monthly", "yearly", "every Monday", or "every 2 weeks".`;
			}
		}
		recurrence = toRecurrence(parsedRecurrence);
	}

	// Parse the remind time (pass parsedRecurrence so parser can advance to next occurrence if needed)
	console.debug('[tasks] createReminder input:', { message, remindAt, repeat, description, parsedRecurrence });
	const parsedTime = parseDateTime(remindAt, new Date(), parsedRecurrence);
	if (!parsedTime) {
		console.error('[tasks] parseDateTime failed for', { remindAt, parsedRecurrence });
		return `Could not understand the time "${remindAt}". Try formats like "today at 3pm", "tomorrow", "next Monday", or "in 2 hours".`;
	}

	const startAt = parsedTime.date.getTime();

	try {
		const payload:Omit<Reminder, "id" | "createdAt" | "updatedAt"> = {
			type: 'reminder',
			title: message,
			description,
			startAt,
			nextTrigger: startAt,
			recurrence,
			status: 'pending',
			triggerCount: 0,
			snoozeCount: 0,
		};

		console.debug('[tasks] calling store.createReminder with', { payload: { ...payload, startAt: new Date(startAt).toISOString() } });
		const reminder = await store.createReminder(payload);
		console.debug('[tasks] store.createReminder returned', { id: reminder.id, nextTrigger: new Date(reminder.nextTrigger).toISOString() });

		const timeStr = new Date(startAt).toLocaleString();
		const repeatStr = recurrence ? `, repeating ${formatRecurrence({ ...recurrence, type: recurrence.type })}` : '';

		return `✓ Reminder set for ${timeStr}${repeatStr}: "${message}"`;
	} catch (error) {
		console.error('[tasks] createReminder error', { error, message, remindAt, repeat });
		return `Error creating reminder: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

/**
 * List upcoming reminders. Shows pending reminders sorted by time.
 *
 * @intent REMINDER_LIST
 * @intent REMINDER_GET
 * @intent REMINDER_SHOW
 * @param params.limit - Maximum number of reminders to show (default: 10).
 * @param params.includeCompleted - Whether to include completed reminders (default: false).
 * @returns string - Formatted list of reminders.
 *
 * @example
 * ```ts
 * // Show next 5 reminders
 * listReminders({ limit: 5 });
 *
 * // Show all upcoming reminders
 * listReminders({});
 *
 * // Include completed reminders
 * listReminders({ includeCompleted: true });
 * ```
 */
export async function listReminders({
	limit = 10,
	includeCompleted = false,
}: {
	limit?: number;
	includeCompleted?: boolean;
} = {}): Promise<string> {
	const store = ensureStorage();

	try {
		const statuses: TaskStatus[] = includeCompleted
			? ['pending', 'snoozed', 'completed']
			: ['pending', 'snoozed'];

		const reminders = await store.listReminders({
			status: statuses,
			limit,
			sortBy: 'nextTrigger',
			sortOrder: 'asc',
		});

		if (reminders.length === 0) {
			return 'No upcoming reminders.';
		}

		let result = '📋 Upcoming Reminders:\n';
		for (const r of reminders) {
			const timeStr = new Date(r.nextTrigger).toLocaleString();
			const repeatStr = r.recurrence ? ` (${formatRecurrence({ ...r.recurrence, type: r.recurrence.type })})` : '';
			const statusIcon = r.status === 'completed' ? '✓' : r.status === 'snoozed' ? '💤' : '⏰';
			result += `${statusIcon} "${r.title}" - ${timeStr}${repeatStr}\n`;
		}

		return result.trim();
	} catch (error) {
		return `Error listing reminders: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

/**
 * Delete a reminder by its title or description.
 *
 * @intent REMINDER_DELETE
 * @intent REMINDER_REMOVE
 * @intent REMINDER_CANCEL
 * @param params.title - Title or partial title of the reminder to delete.
 * @returns string - Confirmation or error message.
 *
 * @example
 * ```ts
 * // Delete reminder by exact title
 * deleteReminder({ title: "Pay rent" });
 *
 * // Delete reminder by partial match
 * deleteReminder({ title: "team meeting" });
 * ```
 */
export async function deleteReminder({ title }: { title: string }): Promise<string> {
	const store = ensureStorage();

	try {
		const reminder = await store.getReminderByTitle(title);
		if (!reminder) {
			return `No reminder found matching "${title}".`;
		}

		const deleted = await store.deleteReminder(reminder.id);
		if (deleted) {
			return `✓ Deleted reminder: "${reminder.title}"`;
		}
		return `Could not delete reminder "${title}".`;
	} catch (error) {
		return `Error deleting reminder: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

/**
 * Snooze a reminder for a specified duration.
 *
 * @intent REMINDER_SNOOZE
 * @param params.title - Title of the reminder to snooze.
 * @param params.duration - How long to snooze: "5 minutes", "1 hour", "tomorrow", etc.
 * @returns string - Confirmation with new reminder time.
 *
 * @example
 * ```ts
 * // Snooze for 10 minutes
 * snoozeReminder({ title: "Call mom", duration: "10 minutes" });
 *
 * // Snooze for 1 hour
 * snoozeReminder({ title: "Meeting prep", duration: "1 hour" });
 *
 * // Snooze until tomorrow
 * snoozeReminder({ title: "Review docs", duration: "tomorrow" });
 * ```
 */
export async function snoozeReminder({
	title,
	duration,
}: {
	title: string;
	duration: string;
}): Promise<string> {
	const store = ensureStorage();

	try {
		const reminder = await store.getReminderByTitle(title);
		if (!reminder) {
			return `No reminder found matching "${title}".`;
		}

		const parsedDuration = parseDateTime(duration);
		if (!parsedDuration) {
			return `Could not understand duration "${duration}". Try "5 minutes", "1 hour", or "tomorrow".`;
		}

		const snoozedUntil = parsedDuration.date.getTime();
		const updated = await store.updateReminder(reminder.id, {
			status: 'snoozed',
			snoozedUntil,
			nextTrigger: snoozedUntil, // Update next trigger to snooze time
			snoozeCount: reminder.snoozeCount + 1,
		});

		if (updated) {
			return `💤 Snoozed "${reminder.title}" until ${parsedDuration.date.toLocaleString()}`;
		}
		return `Could not snooze reminder "${title}".`;
	} catch (error) {
		return `Error snoozing reminder: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

/**
 * Mark a reminder as completed/acknowledged.
 *
 * @intent REMINDER_COMPLETE
 * @intent REMINDER_DONE
 * @intent REMINDER_ACKNOWLEDGE
 * @param params.title - Title of the reminder to complete.
 * @returns string - Confirmation message.
 *
 * @example
 * ```ts
 * completeReminder({ title: "Take medicine" });
 * ```
 */
export async function completeReminder({ title }: { title: string }): Promise<string> {
	const store = ensureStorage();

	try {
		const reminder = await store.getReminderByTitle(title);
		if (!reminder) {
			return `No reminder found matching "${title}".`;
		}

		const now = Date.now();
		const updated = await store.updateReminder(reminder.id, {
			status: 'completed',
			lastTriggeredAt: now,
			triggerCount: reminder.triggerCount + 1,
		});

		if (updated) {
			return `✓ Completed reminder: "${reminder.title}"`;
		}
		return `Could not complete reminder "${title}".`;
	} catch (error) {
		return `Error completing reminder: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// TODO TOOLS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new todo item. Use this when the user wants to add a task to their to-do list.
 *
 * @intent TODO_ADD
 * @intent TODO_CREATE
 * @intent TASK_ADD
 * @param params.task - The task description. Extract the core task from user's request.
 * @param params.priority - Priority level: 'low', 'medium', 'high', or 'urgent'. Default is 'medium'. Use 'urgent' for time-sensitive tasks, 'high' for important tasks, 'low' for nice-to-have tasks.
 * @param params.dueAt - Optional due date in natural language: 'today', 'tomorrow', 'next Friday', 'in 3 days'.
 * @param params.description - Additional notes or context (optional).
 * @param params.estimatedMinutes - Estimated time to complete in minutes (optional).
 * @returns string - Confirmation message with todo details.
 *
 * @example
 * ```ts
 * // Simple todo
 * createTodo({ task: "Buy groceries" });
 *
 * // Todo with high priority
 * createTodo({ task: "Finish quarterly report", priority: "high" });
 *
 * // Todo with due date
 * createTodo({ task: "Submit tax documents", dueAt: "April 15" });
 *
 * // Urgent todo due today
 * createTodo({ task: "Call client back", priority: "urgent", dueAt: "today" });
 *
 * // Todo with time estimate
 * createTodo({ task: "Review pull requests", priority: "medium", estimatedMinutes: 30 });
 * ```
 */
export async function createTodo({
	task,
	priority = 'medium',
	dueAt,
	description,
	estimatedMinutes,
}: {
	task: string;
	priority?: Priority;
	dueAt?: string;
	description?: string;
	estimatedMinutes?: number;
}): Promise<string> {
	const store = ensureStorage();

	// Parse due date if provided
	let parsedDue: number | undefined;
	if (dueAt) {
		const parsed = parseDateTime(dueAt);
		if (!parsed) {
			return `Could not understand the due date "${dueAt}". Try "today", "tomorrow", "next Friday", or "in 3 days".`;
		}
		parsedDue = parsed.date.getTime();
	}

	try {
		const todo = await store.createTodo({
			type: 'todo',
			title: task,
			description,
			priority,
			status: 'pending',
			dueAt: parsedDue,
			estimatedMinutes,
		});

		const priorityEmoji: Record<Priority, string> = {
			low: '🟢',
			medium: '🟡',
			high: '🟠',
			urgent: '🔴',
		};

		let result = `${priorityEmoji[priority]} Created todo: "${task}" [${priority}]`;
		if (parsedDue) {
			result += ` - due ${new Date(parsedDue).toLocaleDateString()}`;
		}

		return result;
	} catch (error) {
		return `Error creating todo: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

/**
 * List todo items with optional filtering.
 *
 * @intent TODO_LIST
 * @intent TODO_GET
 * @intent TODO_SHOW
 * @intent TASK_LIST
 * @param params.limit - Maximum number of todos to show (default: 10).
 * @param params.priority - Filter by priority: 'low', 'medium', 'high', 'urgent', or 'all'.
 * @param params.includeCompleted - Whether to include completed todos (default: false).
 * @returns string - Formatted list of todos.
 *
 * @example
 * ```ts
 * // Show all pending todos
 * listTodos({});
 *
 * // Show only high priority todos
 * listTodos({ priority: "high" });
 *
 * // Show completed todos
 * listTodos({ includeCompleted: true });
 *
 * // Show next 5 urgent tasks
 * listTodos({ limit: 5, priority: "urgent" });
 * ```
 */
export async function listTodos({
	limit = 10,
	priority,
	includeCompleted = false,
}: {
	limit?: number;
	priority?: Priority | 'all';
	includeCompleted?: boolean;
} = {}): Promise<string> {
	const store = ensureStorage();

	try {
		const statuses: TaskStatus[] = includeCompleted
			? ['pending', 'in-progress', 'completed']
			: ['pending', 'in-progress'];

		const todos = await store.listTodos({
			status: statuses,
			priority: priority && priority !== 'all' ? priority : undefined,
			limit,
			sortBy: 'priority',
			sortOrder: 'desc',
		});

		if (todos.length === 0) {
			return priority && priority !== 'all'
				? `No ${priority} priority todos found.`
				: 'No todos found.';
		}

		const priorityEmoji: Record<Priority, string> = {
			low: '🟢',
			medium: '🟡',
			high: '🟠',
			urgent: '🔴',
		};

		let result = '📝 To-Do List:\n';
		for (const t of todos) {
			const statusIcon = t.status === 'completed' ? '✓' : t.status === 'in-progress' ? '▶' : '○';
			const dueStr = t.dueAt ? ` (due ${new Date(t.dueAt).toLocaleDateString()})` : '';
			result += `${statusIcon} ${priorityEmoji[t.priority]} "${t.title}"${dueStr}\n`;
		}

		return result.trim();
	} catch (error) {
		return `Error listing todos: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

/**
 * Mark a todo as completed.
 *
 * @intent TODO_COMPLETE
 * @intent TODO_DONE
 * @intent TODO_FINISH
 * @intent TASK_COMPLETE
 * @param params.task - Title or partial title of the todo to complete.
 * @returns string - Confirmation message.
 *
 * @example
 * ```ts
 * completeTodo({ task: "Buy groceries" });
 * completeTodo({ task: "quarterly report" });
 * ```
 */
export async function completeTodo({ task }: { task: string }): Promise<string> {
	const store = ensureStorage();

	try {
		const todo = await store.getTodoByTitle(task);
		if (!todo) {
			return `No todo found matching "${task}".`;
		}

		const updated = await store.updateTodo(todo.id, {
			status: 'completed',
			completedAt: Date.now(),
			progress: 100,
		});

		if (updated) {
			return `✓ Completed: "${todo.title}"`;
		}
		return `Could not complete todo "${task}".`;
	} catch (error) {
		return `Error completing todo: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

/**
 * Delete a todo item.
 *
 * @intent TODO_DELETE
 * @intent TODO_REMOVE
 * @intent TASK_DELETE
 * @param params.task - Title or partial title of the todo to delete.
 * @returns string - Confirmation or error message.
 *
 * @example
 * ```ts
 * deleteTodo({ task: "Buy groceries" });
 * ```
 */
export async function deleteTodo({ task }: { task: string }): Promise<string> {
	const store = ensureStorage();

	try {
		const todo = await store.getTodoByTitle(task);
		if (!todo) {
			return `No todo found matching "${task}".`;
		}

		const deleted = await store.deleteTodo(todo.id);
		if (deleted) {
			return `✓ Deleted todo: "${todo.title}"`;
		}
		return `Could not delete todo "${task}".`;
	} catch (error) {
		return `Error deleting todo: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

/**
 * Update the priority of a todo item.
 *
 * @intent TODO_UPDATE
 * @intent TODO_PRIORITY
 * @param params.task - Title or partial title of the todo to update.
 * @param params.priority - New priority: 'low', 'medium', 'high', or 'urgent'.
 * @returns string - Confirmation message.
 *
 * @example
 * ```ts
 * // Make task urgent
 * updateTodoPriority({ task: "Client presentation", priority: "urgent" });
 *
 * // Lower priority
 * updateTodoPriority({ task: "Organize desk", priority: "low" });
 * ```
 */
export async function updateTodoPriority({
	task,
	priority,
}: {
	task: string;
	priority: Priority;
}): Promise<string> {
	const store = ensureStorage();

	try {
		const todo = await store.getTodoByTitle(task);
		if (!todo) {
			return `No todo found matching "${task}".`;
		}

		const updated = await store.updateTodo(todo.id, { priority });

		if (updated) {
			const priorityEmoji: Record<Priority, string> = {
				low: '🟢',
				medium: '🟡',
				high: '🟠',
				urgent: '🔴',
			};
			return `${priorityEmoji[priority]} Updated "${todo.title}" to ${priority} priority`;
		}
		return `Could not update todo "${task}".`;
	} catch (error) {
		return `Error updating todo: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

/**
 * Set or update the due date of a todo item.
 *
 * @intent TODO_DUE
 * @intent TODO_DEADLINE
 * @param params.task - Title or partial title of the todo to update.
 * @param params.dueAt - New due date in natural language: 'today', 'tomorrow', 'next Friday'.
 * @returns string - Confirmation message.
 *
 * @example
 * ```ts
 * setTodoDue({ task: "Submit report", dueAt: "Friday" });
 * setTodoDue({ task: "Call client", dueAt: "tomorrow at 2pm" });
 * ```
 */
export async function setTodoDue({
	task,
	dueAt,
}: {
	task: string;
	dueAt: string;
}): Promise<string> {
	const store = ensureStorage();

	const parsed = parseDateTime(dueAt);
	if (!parsed) {
		return `Could not understand the due date "${dueAt}". Try "today", "tomorrow", or "next Friday".`;
	}

	try {
		const todo = await store.getTodoByTitle(task);
		if (!todo) {
			return `No todo found matching "${task}".`;
		}

		const dueTimestamp = parsed.date.getTime();
		const updated = await store.updateTodo(todo.id, { dueAt: dueTimestamp });

		if (updated) {
			return `📅 Set "${todo.title}" due ${parsed.date.toLocaleDateString()}`;
		}
		return `Could not update todo "${task}".`;
	} catch (error) {
		return `Error updating todo: ${error instanceof Error ? error.message : 'Unknown error'}`;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All exported tool functions for AI.
 */
export const taskTools = {
	// Reminders
	createReminder,
	listReminders,
	deleteReminder,
	snoozeReminder,
	completeReminder,

	// Todos
	createTodo,
	listTodos,
	completeTodo,
	deleteTodo,
	updateTodoPriority,
	setTodoDue,
};

export type TaskToolName = keyof typeof taskTools;
