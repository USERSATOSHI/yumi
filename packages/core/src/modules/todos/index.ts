import Elysia, { t } from 'elysia';
import { coreDB } from '../../db/index.js';

export const todos = new Elysia({
	prefix: '/todos',
})
	// Get all todos
	.get('/', ({ query }) => {
		const includeCompleted = query.includeCompleted === 'true';
		const todos = coreDB.getAllTodos(includeCompleted);
		return { success: true, data: todos };
	}, {
		query: t.Object({
			includeCompleted: t.Optional(t.String()),
		}),
	})
	// Get overdue todos
	.get('/overdue', () => {
		const todos = coreDB.getOverdueTodos();
		return { success: true, data: todos };
	})
	// Get todos by priority
	.get('/priority/:priority', ({ params, set }) => {
		const priority = params.priority as 'low' | 'medium' | 'high';
		if (!['low', 'medium', 'high'].includes(priority)) {
			set.status = 400;
			return { success: false, error: 'Invalid priority' };
		}
		const todos = coreDB.getTodosByPriority(priority);
		return { success: true, data: todos };
	})
	// Get single todo
	.get('/:id', ({ params, set }) => {
		const todo = coreDB.getTodo(parseInt(params.id));
		if (!todo) {
			set.status = 404;
			return { success: false, error: 'Todo not found' };
		}
		return { success: true, data: todo };
	})
	// Create todo
	.post('/', ({ body }) => {
		const id = coreDB.addTodo(body.title, {
			description: body.description,
			priority: body.priority,
			dueAt: body.dueAt,
		});
		const todo = coreDB.getTodo(id);
		return { success: true, data: todo };
	}, {
		body: t.Object({
			title: t.String(),
			description: t.Optional(t.String()),
			priority: t.Optional(t.Union([
				t.Literal('low'),
				t.Literal('medium'),
				t.Literal('high'),
			])),
			dueAt: t.Optional(t.Number()),
		}),
	})
	// Update todo
	.put('/:id', ({ params, body, set }) => {
		const success = coreDB.updateTodo(parseInt(params.id), {
			title: body.title,
			description: body.description,
			priority: body.priority,
			dueAt: body.dueAt,
		});
		if (!success) {
			set.status = 404;
			return { success: false, error: 'Todo not found' };
		}
		const todo = coreDB.getTodo(parseInt(params.id));
		return { success: true, data: todo };
	}, {
		body: t.Object({
			title: t.Optional(t.String()),
			description: t.Optional(t.String()),
			priority: t.Optional(t.Union([
				t.Literal('low'),
				t.Literal('medium'),
				t.Literal('high'),
			])),
			dueAt: t.Optional(t.Union([t.Number(), t.Null()])),
		}),
	})
	// Complete todo
	.post('/:id/complete', ({ params, set }) => {
		const success = coreDB.completeTodo(parseInt(params.id));
		if (!success) {
			set.status = 404;
			return { success: false, error: 'Todo not found' };
		}
		return { success: true };
	})
	// Uncomplete todo
	.post('/:id/uncomplete', ({ params, set }) => {
		const success = coreDB.uncompleteTodo(parseInt(params.id));
		if (!success) {
			set.status = 404;
			return { success: false, error: 'Todo not found' };
		}
		return { success: true };
	})
	// Delete todo
	.delete('/:id', ({ params, set }) => {
		const success = coreDB.deleteTodo(parseInt(params.id));
		if (!success) {
			set.status = 404;
			return { success: false, error: 'Todo not found' };
		}
		return { success: true };
	})
	// Clear completed todos
	.delete('/completed', () => {
		const count = coreDB.clearCompletedTodos();
		return { success: true, data: { deleted: count } };
	});

export default todos;
