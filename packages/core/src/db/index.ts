import { Singleton } from '@yumi/patterns';
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { db as logger } from '../integrations/logger/index.js';
import * as yumistats from '@yumi/stats';

const dataDir = process.env.YUMI_DATA_DIR ?? join(process.cwd(), '.yumi');
const dbPath = join(dataDir, 'core.sqlite');

export class CoreDB extends Singleton {
	private db: Database;

	constructor(path: string = dbPath) {
		super();
		mkdirSync(dirname(path), { recursive: true });
		this.db = new Database(path);
		this.setupPragmas();
		this.createSchema();
		logger.info(`CoreDB initialized at ${path}`);
	}

	private setupPragmas() {
		this.db.exec('PRAGMA journal_mode = WAL');
		this.db.exec('PRAGMA synchronous = NORMAL');
	}

	private createSchema() {
		// Reminders table
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS reminders (
				id INTEGER PRIMARY KEY,
				title TEXT NOT NULL,
				description TEXT,
				remind_at INTEGER NOT NULL,
				repeat TEXT,
				completed INTEGER NOT NULL DEFAULT 0,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`);

		this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders (remind_at)
		`);

		this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_reminders_completed ON reminders (completed)
		`);

		// Todos table
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS todos (
				id INTEGER PRIMARY KEY,
				title TEXT NOT NULL,
				description TEXT,
				priority TEXT NOT NULL DEFAULT 'medium',
				due_at INTEGER,
				completed INTEGER NOT NULL DEFAULT 0,
				completed_at INTEGER,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)
		`);

		this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos (completed)
		`);

		this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_todos_due_at ON todos (due_at)
		`);

		this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos (priority)
		`);
	}

	// ─── Reminders ───────────────────────────────────────────────────────────

	addReminder(
		title: string,
		remindAt: number,
		options: { description?: string; repeat?: 'daily' | 'weekly' | 'monthly' | 'yearly' } = {}
	) {
		const now = Date.now();
		const result = this.db.prepare(`
			INSERT INTO reminders (title, description, remind_at, repeat, created_at, updated_at)
			VALUES ($title, $description, $remindAt, $repeat, $now, $now)
		`).run({
			$title: title,
			$description: options.description ?? null,
			$remindAt: remindAt,
			$repeat: options.repeat ?? null,
			$now: now,
		});
		return result.lastInsertRowid as number;
	}

	getReminder(id: number) {
		return this.db.prepare(`
			SELECT id, title, description, remind_at, repeat, completed, created_at, updated_at
			FROM reminders WHERE id = $id
		`).get({ $id: id }) as {
			id: number;
			title: string;
			description: string | null;
			remind_at: number;
			repeat: string | null;
			completed: number;
			created_at: number;
			updated_at: number;
		} | null;
	}

	getUpcomingReminders(limit: number = 10) {
		return this.db.prepare(`
			SELECT id, title, description, remind_at, repeat, completed, created_at, updated_at
			FROM reminders
			WHERE completed = 0 AND remind_at >= $now
			ORDER BY remind_at ASC
			LIMIT $limit
		`).all({ $now: Date.now(), $limit: limit }) as {
			id: number;
			title: string;
			description: string | null;
			remind_at: number;
			repeat: string | null;
			completed: number;
			created_at: number;
			updated_at: number;
		}[];
	}

	getDueReminders() {
		return this.db.prepare(`
			SELECT id, title, description, remind_at, repeat, completed, created_at, updated_at
			FROM reminders
			WHERE completed = 0 AND remind_at <= $now
			ORDER BY remind_at ASC
		`).all({ $now: Date.now() }) as {
			id: number;
			title: string;
			description: string | null;
			remind_at: number;
			repeat: string | null;
			completed: number;
			created_at: number;
			updated_at: number;
		}[];
	}

	completeReminder(id: number) {
		const reminder = this.getReminder(id);
		if (!reminder) return false;

		if (reminder.repeat) {
			// Reschedule based on repeat interval
			const nextRemindAt = this.calculateNextRemindAt(reminder.remind_at, reminder.repeat);
			this.db.prepare(`
				UPDATE reminders SET remind_at = $remindAt, updated_at = $now WHERE id = $id
			`).run({ $id: id, $remindAt: nextRemindAt, $now: Date.now() });
		} else {
			this.db.prepare(`
				UPDATE reminders SET completed = 1, updated_at = $now WHERE id = $id
			`).run({ $id: id, $now: Date.now() });
		}
		return true;
	}

	private calculateNextRemindAt(currentRemindAt: number, repeat: string): number {
		const date = new Date(currentRemindAt);
		switch (repeat) {
			case 'daily':
				date.setDate(date.getDate() + 1);
				break;
			case 'weekly':
				date.setDate(date.getDate() + 7);
				break;
			case 'monthly':
				date.setMonth(date.getMonth() + 1);
				break;
			case 'yearly':
				date.setFullYear(date.getFullYear() + 1);
				break;
		}
		return date.getTime();
	}

	deleteReminder(id: number) {
		return this.db.prepare(`DELETE FROM reminders WHERE id = $id`).run({ $id: id }).changes > 0;
	}

	// ─── Todos ───────────────────────────────────────────────────────────────

	addTodo(
		title: string,
		options: { description?: string; priority?: 'low' | 'medium' | 'high'; dueAt?: number } = {}
	) {
		const now = Date.now();
		const result = this.db.prepare(`
			INSERT INTO todos (title, description, priority, due_at, created_at, updated_at)
			VALUES ($title, $description, $priority, $dueAt, $now, $now)
		`).run({
			$title: title,
			$description: options.description ?? null,
			$priority: options.priority ?? 'medium',
			$dueAt: options.dueAt ?? null,
			$now: now,
		});
		return result.lastInsertRowid as number;
	}

	getTodo(id: number) {
		return this.db.prepare(`
			SELECT id, title, description, priority, due_at, completed, completed_at, created_at, updated_at
			FROM todos WHERE id = $id
		`).get({ $id: id }) as {
			id: number;
			title: string;
			description: string | null;
			priority: string;
			due_at: number | null;
			completed: number;
			completed_at: number | null;
			created_at: number;
			updated_at: number;
		} | null;
	}

	getAllTodos(includeCompleted: boolean = false) {
		const query = includeCompleted
			? `SELECT id, title, description, priority, due_at, completed, completed_at, created_at, updated_at
			   FROM todos ORDER BY completed ASC, priority DESC, due_at ASC NULLS LAST, created_at DESC`
			: `SELECT id, title, description, priority, due_at, completed, completed_at, created_at, updated_at
			   FROM todos WHERE completed = 0 ORDER BY priority DESC, due_at ASC NULLS LAST, created_at DESC`;

		return this.db.prepare(query).all() as {
			id: number;
			title: string;
			description: string | null;
			priority: string;
			due_at: number | null;
			completed: number;
			completed_at: number | null;
			created_at: number;
			updated_at: number;
		}[];
	}

	getTodosByPriority(priority: 'low' | 'medium' | 'high' | 'urgent') {
		return this.db.prepare(`
			SELECT id, title, description, priority, due_at, completed, completed_at, created_at, updated_at
			FROM todos WHERE priority = $priority AND completed = 0
			ORDER BY due_at ASC NULLS LAST, created_at DESC
		`).all({ $priority: priority }) as {
			id: number;
			title: string;
			description: string | null;
			priority: string;
			due_at: number | null;
			completed: number;
			completed_at: number | null;
			created_at: number;
			updated_at: number;
		}[];
	}

	getOverdueTodos() {
		return this.db.prepare(`
			SELECT id, title, description, priority, due_at, completed, completed_at, created_at, updated_at
			FROM todos WHERE completed = 0 AND due_at IS NOT NULL AND due_at < $now
			ORDER BY due_at ASC
		`).all({ $now: Date.now() }) as {
			id: number;
			title: string;
			description: string | null;
			priority: string;
			due_at: number | null;
			completed: number;
			completed_at: number | null;
			created_at: number;
			updated_at: number;
		}[];
	}

	completeTodo(id: number) {
		const now = Date.now();
		return this.db.prepare(`
			UPDATE todos SET completed = 1, completed_at = $now, updated_at = $now WHERE id = $id
		`).run({ $id: id, $now: now }).changes > 0;
	}

	uncompleteTodo(id: number) {
		return this.db.prepare(`
			UPDATE todos SET completed = 0, completed_at = NULL, updated_at = $now WHERE id = $id
		`).run({ $id: id, $now: Date.now() }).changes > 0;
	}

	updateTodo(
		id: number,
		updates: { title?: string; description?: string; priority?: 'low' | 'medium' | 'high' | 'urgent'; dueAt?: number | null }
	) {
		const todo = this.getTodo(id);
		if (!todo) return false;

		this.db.prepare(`
			UPDATE todos SET 
				title = $title, 
				description = $description, 
				priority = $priority, 
				due_at = $dueAt, 
				updated_at = $now 
			WHERE id = $id
		`).run({
			$id: id,
			$title: updates.title ?? todo.title,
			$description: updates.description !== undefined ? updates.description : todo.description,
			$priority: updates.priority ?? todo.priority,
			$dueAt: updates.dueAt !== undefined ? updates.dueAt : todo.due_at,
			$now: Date.now(),
		});
		return true;
	}

	deleteTodo(id: number) {
		return this.db.prepare(`DELETE FROM todos WHERE id = $id`).run({ $id: id }).changes > 0;
	}

	clearCompletedTodos() {
		return this.db.prepare(`DELETE FROM todos WHERE completed = 1`).run().changes;
	}

	close() {
		this.db.close();
	}
}

export const statDB = yumistats.createStats();
export const coreDB = CoreDB.getInstance();