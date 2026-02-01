/**
 * Priority levels for tasks.
 */
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Status of a task.
 */
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'snoozed';

/**
 * Recurrence type for reminders.
 */
export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Recurrence configuration for reminders.
 * 
 * Examples:
 * - Every day: { type: 'daily', interval: 1 }
 * - Every 2 weeks: { type: 'weekly', interval: 2 }
 * - Every Monday and Friday: { type: 'weekly', interval: 1, daysOfWeek: [1, 5] }
 * - 15th of every month: { type: 'monthly', interval: 1, dayOfMonth: 15 }
 * - Every March 15th: { type: 'yearly', interval: 1, monthOfYear: 3, dayOfMonth: 15 }
 */
export interface Recurrence {
	/** Type of recurrence */
	type: Exclude<RecurrenceType, 'once'>;
	/** Interval - every X days/weeks/months/years (default: 1) */
	interval: number;
	/** Days of week (0=Sun, 1=Mon, ..., 6=Sat) - for weekly type */
	daysOfWeek?: number[];
	/** Day of month (1-31) - for monthly/yearly type */
	dayOfMonth?: number;
	/** Month of year (1-12) - for yearly type */
	monthOfYear?: number;
	/** Stop recurring after this timestamp */
	endAt?: number;
	/** Stop after this many occurrences */
	maxOccurrences?: number;
}

/**
 * Base task interface shared by reminders and todos.
 */
export interface BaseTask {
	id: string;
	title: string;
	description?: string;
	createdAt: number;
	updatedAt: number;
	tags?: string[];
	metadata?: Record<string, unknown>;
}

/**
 * Reminder interface with advanced scheduling support.
 * 
 * The `nextTrigger` field is a precomputed timestamp for efficient querying.
 * It gets updated after each trigger based on the recurrence pattern.
 */
export interface Reminder extends BaseTask {
	type: 'reminder';
	/** First occurrence / start time (timestamp) */
	startAt: number;
	/** Precomputed next trigger time for efficient querying (timestamp) */
	nextTrigger: number;
	/** Recurrence configuration (undefined = one-time reminder) */
	recurrence?: Recurrence;
	/** Current status */
	status: TaskStatus;
	/** Last time the reminder was triggered (timestamp) */
	lastTriggeredAt?: number;
	/** How many times this reminder has been triggered */
	triggerCount: number;
	/** Number of times snoozed */
	snoozeCount: number;
	/** If snoozed, when to remind again (timestamp) */
	snoozedUntil?: number;
}

/**
 * Todo item interface with advanced tracking.
 */
export interface Todo extends BaseTask {
	type: 'todo';
	/** Priority level */
	priority: Priority;
	/** Status of the todo */
	status: TaskStatus;
	/** Optional due date (timestamp) */
	dueAt?: number;
	/** When the todo was completed (timestamp) */
	completedAt?: number;
	/** Estimated duration in minutes */
	estimatedMinutes?: number;
	/** Actual duration in minutes (if tracked) */
	actualMinutes?: number;
	/** Parent todo ID for subtasks */
	parentId?: string;
	/** Subtask IDs */
	subtaskIds?: string[];
	/** Completion percentage (0-100) */
	progress?: number;
}

/**
 * Union type for all task types.
 */
export type Task = Reminder | Todo;

/**
 * Input for creating a reminder via AI.
 */
export interface CreateReminderInput {
	/** What to remind about */
	message: string;
	/** When to remind - natural language like "today at 3pm", "tomorrow", "in 2 hours" */
	remindAt: string;
	/** Optional repeat pattern - "daily", "weekly", "monthly", "yearly", or natural language like "every Monday" */
	repeat?: string;
	/** Optional description/notes */
	description?: string;
	/** Optional tags for categorization */
	tags?: string[];
}

/**
 * Input for creating a todo via AI.
 */
export interface CreateTodoInput {
	/** Task description */
	task: string;
	/** Priority level */
	priority?: Priority;
	/** Optional due date - natural language */
	dueAt?: string;
	/** Optional description/notes */
	description?: string;
	/** Optional tags for categorization */
	tags?: string[];
	/** Estimated time in minutes */
	estimatedMinutes?: number;
}

/**
 * Result of a task operation.
 */
export interface TaskOperationResult {
	success: boolean;
	message: string;
	task?: Task;
}

/**
 * Query options for listing tasks.
 */
export interface TaskQueryOptions {
	/** Filter by status */
	status?: TaskStatus | TaskStatus[];
	/** Filter by tags (any match) */
	tags?: string[];
	/** Filter by priority (todos only) */
	priority?: Priority | Priority[];
	/** Filter by due/remind date range (timestamps) */
	from?: number;
	to?: number;
	/** Maximum number of results */
	limit?: number;
	/** Sort field */
	sortBy?: 'createdAt' | 'updatedAt' | 'dueAt' | 'nextTrigger' | 'priority';
	/** Sort order */
	sortOrder?: 'asc' | 'desc';
}

/**
 * Snooze options.
 */
export interface SnoozeOptions {
	/** Snooze duration - natural language like "5 minutes", "1 hour", "tomorrow" */
	duration: string;
}

/**
 * Task storage interface - implement this to provide persistence.
 */
export interface TaskStorage {
	// Reminders
	createReminder(reminder: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Reminder>;
	getReminder(id: string): Promise<Reminder | null>;
	getReminderByTitle(title: string): Promise<Reminder | null>;
	updateReminder(id: string, updates: Partial<Reminder>): Promise<Reminder | null>;
	deleteReminder(id: string): Promise<boolean>;
	listReminders(options?: TaskQueryOptions): Promise<Reminder[]>;
	/** Get reminders where nextTrigger <= before */
	getDueReminders(before?: number): Promise<Reminder[]>;

	// Todos
	createTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo>;
	getTodo(id: string): Promise<Todo | null>;
	getTodoByTitle(title: string): Promise<Todo | null>;
	updateTodo(id: string, updates: Partial<Todo>): Promise<Todo | null>;
	deleteTodo(id: string): Promise<boolean>;
	listTodos(options?: TaskQueryOptions): Promise<Todo[]>;
	getOverdueTodos(before?: number): Promise<Todo[]>;
}
