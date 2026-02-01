import { Singleton } from '@yumi/patterns';
import { Result } from '@yumi/results';
import { coreDB, CoreDB } from '../../db/index.js';
import { TodoPoolError } from './error';

export type Todo = {
	id: number;
	title: string;
	description: string | null;
	priority: 'low' | 'medium' | 'high';
	dueAt: number | null;
	completed: boolean;
	completedAt: number | null;
	createdAt: number;
	updatedAt: number;
};

export interface TodoPoolOptions {
	sweepInterval?: number; // How often to check for overdue todos (ms)
	onOverdue?: (todos: Todo[]) => void | Promise<void>; // Callback for overdue todos
}

export class TodoPool extends Singleton {
	#db: CoreDB = coreDB
	#titleToId: Map<string, number> = new Map(); // title -> id (for AI lookup)
	#sweepInterval: Timer | null = null;
	#onOverdue: ((todos: Todo[]) => void | Promise<void>) | null = null;

	constructor(options: TodoPoolOptions = {}) {
		super();
		this.#onOverdue = options.onOverdue ?? null;

		// Load existing todos into memory
		this.#syncFromDB();

		// Start sweeper for overdue notifications
		const interval = options.sweepInterval ?? 300_000; // Default 5 minutes
		this.#startSweeper(interval);
	}

	#syncFromDB() {
		const todos = this.#db.getAllTodos(true);
		for (const row of todos) {
			this.#titleToId.set(row.title.toLowerCase(), row.id);
		}
	}

	#rowToTodo(row: {
		id: number;
		title: string;
		description: string | null;
		priority: string;
		due_at: number | null;
		completed: number;
		completed_at: number | null;
		created_at: number;
		updated_at: number;
	}): Todo {
		return {
			id: row.id,
			title: row.title,
			description: row.description,
			priority: row.priority as Todo['priority'],
			dueAt: row.due_at,
			completed: row.completed === 1,
			completedAt: row.completed_at,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	#startSweeper(interval: number) {
		this.#sweepInterval = setInterval(() => {
			this.sweep();
		}, interval);
	}

	// ─── Public API (AI-friendly, uses titles) ───────────────────────────────

	/**
	 * Add a new todo
	 */
	add(
		title: string,
		options: { description?: string; priority?: 'low' | 'medium' | 'high'; dueAt?: number | Date } = {}
	): Result<Todo, TodoPoolError> {
		const normalizedTitle = title.toLowerCase();

		if (this.#titleToId.has(normalizedTitle)) {
			return Result.err(TodoPoolError.TodoAlreadyExists);
		}

		const dueAt = options.dueAt instanceof Date ? options.dueAt.getTime() : options.dueAt;

		const id = this.#db.addTodo(title, {
			description: options.description,
			priority: options.priority,
			dueAt,
		});

		const row = this.#db.getTodo(id);
		if (!row) {
			return Result.err(TodoPoolError.TodoNotFound);
		}

		this.#titleToId.set(normalizedTitle, id);
		return Result.ok(this.#rowToTodo(row));
	}

	/**
	 * Get a todo by title (for AI)
	 */
	get(title: string): Result<Todo, TodoPoolError> {
		const id = this.#titleToId.get(title.toLowerCase());
		if (!id) {
			return Result.err(TodoPoolError.TodoNotFound);
		}

		const row = this.#db.getTodo(id);
		if (!row) {
			this.#titleToId.delete(title.toLowerCase());
			return Result.err(TodoPoolError.TodoNotFound);
		}

		return Result.ok(this.#rowToTodo(row));
	}

	/**
	 * Complete a todo by title
	 */
	complete(title: string): Result<boolean, TodoPoolError> {
		const id = this.#titleToId.get(title.toLowerCase());
		if (!id) {
			return Result.err(TodoPoolError.TodoNotFound);
		}

		return Result.ok(this.#db.completeTodo(id));
	}

	/**
	 * Uncomplete a todo by title
	 */
	uncomplete(title: string): Result<boolean, TodoPoolError> {
		const id = this.#titleToId.get(title.toLowerCase());
		if (!id) {
			return Result.err(TodoPoolError.TodoNotFound);
		}

		return Result.ok(this.#db.uncompleteTodo(id));
	}

	/**
	 * Update a todo by title
	 */
	update(
		title: string,
		updates: { title?: string; description?: string; priority?: 'low' | 'medium' | 'high' | 'urgent'; dueAt?: number | Date | null }
	): Result<Todo, TodoPoolError> {
		const id = this.#titleToId.get(title.toLowerCase());
		if (!id) {
			return Result.err(TodoPoolError.TodoNotFound);
		}

		const dueAt = updates.dueAt instanceof Date ? updates.dueAt.getTime() : updates.dueAt;

		// If title is changing, update the map
		if (updates.title && updates.title.toLowerCase() !== title.toLowerCase()) {
			if (this.#titleToId.has(updates.title.toLowerCase())) {
				return Result.err(TodoPoolError.TodoAlreadyExists);
			}
			this.#titleToId.delete(title.toLowerCase());
			this.#titleToId.set(updates.title.toLowerCase(), id);
		}

		this.#db.updateTodo(id, {
			title: updates.title,
			description: updates.description,
			priority: updates.priority,
			dueAt,
		});

		const row = this.#db.getTodo(id);
		if (!row) {
			return Result.err(TodoPoolError.TodoNotFound);
		}

		return Result.ok(this.#rowToTodo(row));
	}

	/**
	 * Delete a todo by title
	 */
	delete(title: string): Result<boolean, TodoPoolError> {
		const id = this.#titleToId.get(title.toLowerCase());
		if (!id) {
			return Result.err(TodoPoolError.TodoNotFound);
		}

		const success = this.#db.deleteTodo(id);
		if (success) {
			this.#titleToId.delete(title.toLowerCase());
		}

		return Result.ok(success);
	}

	/**
	 * List all todos (optionally including completed)
	 */
	list(includeCompleted: boolean = false): Todo[] {
		return this.#db.getAllTodos(includeCompleted).map((row) => this.#rowToTodo(row));
	}

	/**
	 * List todos by priority
	 */
	listByPriority(priority: 'low' | 'medium' | 'high'): Todo[] {
		return this.#db.getTodosByPriority(priority).map((row) => this.#rowToTodo(row));
	}

	/**
	 * Get overdue todos
	 */
	getOverdue(): Todo[] {
		return this.#db.getOverdueTodos().map((row) => this.#rowToTodo(row));
	}

	/**
	 * Find todos by partial title match (for AI fuzzy lookup)
	 */
	find(query: string): Todo[] {
		const q = query.toLowerCase();
		const matches: Todo[] = [];

		for (const [title, id] of this.#titleToId) {
			if (title.includes(q)) {
				const row = this.#db.getTodo(id);
				if (row) matches.push(this.#rowToTodo(row));
			}
		}

		return matches;
	}

	/**
	 * Check if a todo exists by title
	 */
	has(title: string): boolean {
		return this.#titleToId.has(title.toLowerCase());
	}

	/**
	 * Sweep: check for overdue todos and trigger callback
	 */
	sweep(): number {
		const overdue = this.getOverdue();

		if (overdue.length > 0 && this.#onOverdue) {
			try {
				this.#onOverdue(overdue);
			} catch (e) {
				console.error('Overdue callback failed:', e);
			}
		}

		return overdue.length;
	}

	/**
	 * Clear all completed todos
	 */
	clearCompleted(): number {
		const completed = this.#db.getAllTodos(true).filter((t) => t.completed === 1);
		for (const todo of completed) {
			this.#titleToId.delete(todo.title.toLowerCase());
		}
		return this.#db.clearCompletedTodos();
	}

	/**
	 * Set the overdue callback
	 */
	onOverdue(callback: (todos: Todo[]) => void | Promise<void>) {
		this.#onOverdue = callback;
	}

	/**
	 * Get count of active (non-completed) todos
	 */
	get count(): number {
		return this.list().length;
	}

	/**
	 * Get count of all todos including completed
	 */
	get totalCount(): number {
		return this.#titleToId.size;
	}

	/**
	 * Stop the sweeper
	 */
	destroy() {
		if (this.#sweepInterval) {
			clearInterval(this.#sweepInterval);
			this.#sweepInterval = null;
		}
		this.#titleToId.clear();
	}
}
export const todoPool = TodoPool.getInstance();