# @yumi/tasks

Advanced reminders and todos with natural language parsing for AI tool integration.

## Features

- **Natural Language Date/Time Parsing**: Understands "today", "tomorrow", "next Monday", "3pm", "in 2 hours", etc.
- **Advanced Recurrence**: Daily, weekly (with specific days), monthly, yearly, and custom intervals
- **AI-Ready Tool Schemas**: Comprehensive JSDoc with `@intent` tags for automatic schema generation
- **Pluggable Storage**: Implement your own storage backend
- **Type-Safe**: Full TypeScript support

## Installation

```bash
bun add @yumi/tasks
```

## Usage

### Basic Setup

```typescript
import { setTaskStorage, getTaskToolSchemas, taskTools } from '@yumi/tasks';

// 1. Implement and set your storage
setTaskStorage(myStorageImplementation);

// 2. Get tool schemas for AI
const taskSchemas = getTaskToolSchemas();

// 3. Merge with your existing tools
const allTools = [...existingTools, ...taskSchemas];
```

### Using Tools Directly

```typescript
import { createReminder, createTodo, listReminders, listTodos } from '@yumi/tasks';

// Create a monthly reminder
await createReminder({
  message: "Pay rent",
  remindAt: "today",
  repeat: "monthly"
});

// Create a high-priority todo with due date
await createTodo({
  task: "Finish quarterly report",
  priority: "high",
  dueAt: "Friday"
});

// List upcoming reminders
const reminders = await listReminders({ limit: 5 });

// List high-priority todos
const todos = await listTodos({ priority: "high" });
```

### Natural Language Support

#### Date/Time Parsing

| Input | Result |
|-------|--------|
| `"today"` | Today at 9:00 AM |
| `"tomorrow"` | Tomorrow at 9:00 AM |
| `"tomorrow at 3pm"` | Tomorrow at 3:00 PM |
| `"next Monday"` | Next Monday at 9:00 AM |
| `"in 2 hours"` | 2 hours from now |
| `"Feb 15"` | February 15th at 9:00 AM |
| `"2026-03-15 at 14:30"` | March 15, 2026 at 2:30 PM |

#### Recurrence Patterns

| Input | Result |
|-------|--------|
| `"daily"` | Every day |
| `"weekly"` | Every week |
| `"monthly"` | Every month |
| `"yearly"` | Every year |
| `"every Monday"` | Every Monday |
| `"every Mon and Wed"` | Every Monday and Wednesday |
| `"every 2 weeks"` | Every 2 weeks |
| `"every 15th"` | 15th of every month |

## Implementing Storage

```typescript
import type { TaskStorage, Reminder, Todo, TaskQueryOptions } from '@yumi/tasks';

class MyTaskStorage implements TaskStorage {
  async createReminder(reminder: Omit<Reminder, 'id' | 'createdAt' | 'updatedAt'>): Promise<Reminder> {
    // Implement storage logic
  }

  async getReminder(id: string): Promise<Reminder | null> {
    // Implement retrieval logic
  }

  // ... implement all other methods
}
```

## AI Tool Integration

The package exports tool functions with comprehensive JSDoc that can be parsed by `@yumi/tools`:

```typescript
import { getTaskToolSchemas, getTaskIntentMapping } from '@yumi/tasks';

// Get all tool schemas
const schemas = getTaskToolSchemas();
// [
//   { type: 'function', function: { name: 'createReminder', ... } },
//   { type: 'function', function: { name: 'listReminders', ... } },
//   ...
// ]

// Get intent-to-tools mapping
const intents = getTaskIntentMapping();
// {
//   'REMINDER_ADD': ['createReminder'],
//   'REMINDER_LIST': ['listReminders'],
//   'TODO_ADD': ['createTodo'],
//   ...
// }
```

## API Reference

### Reminder Tools

- `createReminder({ message, remindAt, repeat?, description? })` - Create a new reminder
- `listReminders({ limit?, includeCompleted? })` - List upcoming reminders
- `deleteReminder({ title })` - Delete a reminder by title
- `snoozeReminder({ title, duration })` - Snooze a reminder
- `completeReminder({ title })` - Mark a reminder as completed

### Todo Tools

- `createTodo({ task, priority?, dueAt?, description?, estimatedMinutes? })` - Create a new todo
- `listTodos({ limit?, priority?, includeCompleted? })` - List todos
- `completeTodo({ task })` - Mark a todo as completed
- `deleteTodo({ task })` - Delete a todo
- `updateTodoPriority({ task, priority })` - Change todo priority
- `setTodoDue({ task, dueAt })` - Set/update due date

### Parser Functions

- `parseDateTime(input, referenceDate?)` - Parse natural language date/time
- `parseRecurrence(input)` - Parse recurrence pattern
- `parseTime(timeStr)` - Parse time string
- `getNextOccurrence(currentDate, recurrence)` - Calculate next occurrence
- `formatRecurrence(recurrence)` - Format recurrence for display

## License

MIT
