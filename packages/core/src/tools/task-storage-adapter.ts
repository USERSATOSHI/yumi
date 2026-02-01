/**
 * Adapter that bridges @yumi/tasks storage interface with core's existing pools.
 * 
 * This allows the new task tools from @yumi/tasks to use the existing
 * reminderPool and todoPool implementations in core.
 */

import type { TaskStorage, Reminder, Todo, TaskQueryOptions } from '@yumi/tasks';
import { reminderPool, type Reminder as CoreReminder } from '../pool/reminders/index.js';
import { todoPool, type Todo as CoreTodo } from '../pool/todos/index.js';

/**
 * Convert core Reminder to @yumi/tasks Reminder format.
 */
function coreToTaskReminder(core: CoreReminder): Reminder {
	return {
		id: String(core.id),
		type: 'reminder',
		title: core.title,
		description: core.description ?? undefined,
		startAt: core.remindAt,
		nextTrigger: core.remindAt,
		recurrence: core.repeat ? {
			type: core.repeat,
			interval: 1,
		} : undefined,
		status: core.completed ? 'completed' : 'pending',
		triggerCount: 0,
		snoozeCount: 0,
		createdAt: core.createdAt,
		updatedAt: core.updatedAt,
	};
}

/**
 * Convert core Todo to @yumi/tasks Todo format.
 */
function coreToTaskTodo(core: CoreTodo): Todo {
	return {
		id: String(core.id),
		type: 'todo',
		title: core.title,
		description: core.description ?? undefined,
		priority: core.priority as Todo['priority'],
		status: core.completed ? 'completed' : 'pending',
		completedAt: core.completedAt ?? undefined,
		dueAt: core.dueAt ?? undefined,
		createdAt: core.createdAt,
		updatedAt: core.updatedAt,
	};
}

/**
 * TaskStorage adapter for core pools.
 */
export const coreTaskStorage: TaskStorage = {
	// ─────────────────────────────────────────────────────────────────────────
	// REMINDERS
	// ─────────────────────────────────────────────────────────────────────────

	async createReminder(reminder) {
		const recurrence = reminder.recurrence;
		const repeat = recurrence?.type as CoreReminder['repeat'] ?? null;

		// If startAt is in the past, adjust to now + 1 minute
		let startAt = reminder.startAt;
		const now = Date.now();
		if (startAt <= now) {
			startAt = now + 60_000; // 1 minute from now
		}

		try {
			console.debug('[task-storage-adapter] createReminder input:', {
				title: reminder.title,
				startAt: new Date(startAt).toISOString(),
				description: reminder.description,
				recurrence: reminder.recurrence,
				repeat,
			});

			const result = reminderPool.add(reminder.title, startAt, {
				description: reminder.description,
				repeat: repeat ?? undefined,
			});

			if (result.isErr()) {
				const err = result.unwrapErr();
				console.error('[task-storage-adapter] reminderPool.add failed', {
					title: reminder.title,
					startAt: new Date(startAt).toISOString(),
					repeat,
					error: err?.message ?? err,
				});
				throw new Error(`Failed to create reminder: ${err?.message ?? 'Unknown error'}`);
			}

			const created = result.unwrap()!;
			console.debug('[task-storage-adapter] createReminder success', { id: created.id, title: created.title, remindAt: new Date(created.remindAt).toISOString() });
			return coreToTaskReminder(created);
		} catch (e) {
			console.error('[task-storage-adapter] createReminder exception', e);
			throw e;
		}
	},

	async getReminder(id) {
		const reminders = reminderPool.list();
		const found = reminders.find(r => String(r.id) === id);
		return found ? coreToTaskReminder(found) : null;
	},

	async getReminderByTitle(title) {
		const result = reminderPool.get(title);
		if (result.isErr()) return null;
		const found = result.unwrap();
		return found ? coreToTaskReminder(found) : null;
	},

	async updateReminder(id, updates) {
		// ReminderPool doesn't have an update method
		// For now, we can only mark as complete
		const reminders = reminderPool.list();
		const found = reminders.find(r => String(r.id) === id);
		if (!found) return null;
		
		if (updates.status === 'completed') {
			reminderPool.complete(found.title);
		}
		
		// Re-fetch after update
		const updated = reminderPool.list().find(r => String(r.id) === id);
		return updated ? coreToTaskReminder(updated) : null;
	},

	async deleteReminder(id) {
		const reminders = reminderPool.list();
		const found = reminders.find(r => String(r.id) === id);
		if (!found) return false;
		
		const result = reminderPool.delete(found.title);
		return result.isOk();
	},

	async listReminders(options?: TaskQueryOptions) {
		const all = reminderPool.list();
		let filtered = all;
		
		// Filter by status
		if (options?.status) {
			const statuses = Array.isArray(options.status) ? options.status : [options.status];
			filtered = filtered.filter(r => {
				const status = r.completed ? 'completed' : 'pending';
				return statuses.includes(status);
			});
		}
		
		// Sort
		if (options?.sortBy === 'nextTrigger') {
			filtered.sort((a, b) => a.remindAt - b.remindAt);
		}
		if (options?.sortOrder === 'desc') {
			filtered.reverse();
		}
		
		// Limit
		if (options?.limit) {
			filtered = filtered.slice(0, options.limit);
		}
		
		return filtered.map(coreToTaskReminder);
	},

	async getDueReminders(before?: number) {
		const now = before ?? Date.now();
		const all = reminderPool.list();
		return all
			.filter(r => !r.completed && r.remindAt <= now)
			.map(coreToTaskReminder);
	},

	// ─────────────────────────────────────────────────────────────────────────
	// TODOS
	// ─────────────────────────────────────────────────────────────────────────

	async createTodo(todo) {
		// Map "urgent" to "high" since core todoPool doesn't support "urgent"
		const priority = todo.priority === 'urgent' ? 'high' : todo.priority;
		const result = todoPool.add(todo.title, {
			priority,
			description: todo.description,
		});
		
		if (result.isErr()) {
			throw new Error(result.unwrapErr()!.message);
		}
		
		return coreToTaskTodo(result.unwrap()!);
	},

	async getTodo(id) {
		const todos = todoPool.list(true);
		const found = todos.find(t => String(t.id) === id);
		return found ? coreToTaskTodo(found) : null;
	},

	async getTodoByTitle(title) {
		const result = todoPool.get(title);
		if (result.isErr()) return null;
		const found = result.unwrap();
		return found ? coreToTaskTodo(found) : null;
	},

	async updateTodo(id, updates) {
		const todos = todoPool.list(true);
		const found = todos.find(t => String(t.id) === id);
		if (!found) return null;
		
		// Map priority - core doesn't support 'urgent', map to 'high'
		let priority = updates.priority;
		if (priority === 'urgent') {
			priority = 'high';
		}
		
		const result = todoPool.update(found.title, {
			title: updates.title,
			priority: priority as 'low' | 'medium' | 'high',
			description: updates.description,
			dueAt: updates.dueAt,
		});
		
		if (result.isErr()) return null;
		return coreToTaskTodo(result.unwrap()!);
	},

	async deleteTodo(id) {
		const todos = todoPool.list(true);
		const found = todos.find(t => String(t.id) === id);
		if (!found) return false;
		
		const result = todoPool.delete(found.title);
		return result.isOk();
	},

	async listTodos(options?: TaskQueryOptions) {
		const includeCompleted = options?.status?.includes?.('completed') ?? false;
		let all = todoPool.list(includeCompleted);
		
		// Filter by status
		if (options?.status) {
			const statuses = Array.isArray(options.status) ? options.status : [options.status];
			all = all.filter(t => {
				const status = t.completed ? 'completed' : 'pending';
				return statuses.includes(status);
			});
		}
		
		// Filter by priority
		if (options?.priority) {
			const priorities = Array.isArray(options.priority) ? options.priority : [options.priority];
			all = all.filter(t => priorities.includes(t.priority as any));
		}
		
		// Sort by priority
		if (options?.sortBy === 'priority') {
			const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
			all.sort((a, b) => 
				(priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) - 
				(priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2)
			);
		}
		
		if (options?.sortOrder === 'desc') {
			all.reverse();
		}
		
		// Limit
		if (options?.limit) {
			all = all.slice(0, options.limit);
		}
		
		return all.map(coreToTaskTodo);
	},

	async getOverdueTodos(before?: number) {
		// Core todos don't have due dates tracked the same way
		// Return empty for now
		return [];
	},
};
