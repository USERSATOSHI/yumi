import Elysia, { t } from 'elysia';
import { coreDB } from '../../db/index.js';

export const reminders = new Elysia({
	prefix: '/reminders',
})
	// Get all upcoming reminders
	.get('/', ({ query }) => {
		const limit = query.limit ? parseInt(query.limit) : 50;
		const reminders = coreDB.getUpcomingReminders(limit);
		return { success: true, data: reminders };
	}, {
		query: t.Object({
			limit: t.Optional(t.String()),
		}),
	})
	// Get due reminders
	.get('/due', () => {
		const reminders = coreDB.getDueReminders();
		return { success: true, data: reminders };
	})
	// Get single reminder
	.get('/:id', ({ params, set }) => {
		const reminder = coreDB.getReminder(parseInt(params.id));
		if (!reminder) {
			set.status = 404;
			return { success: false, error: 'Reminder not found' };
		}
		return { success: true, data: reminder };
	})
	// Create reminder
	.post('/', ({ body }) => {
		const id = coreDB.addReminder(body.title, body.remindAt, {
			description: body.description,
			repeat: body.repeat,
		});
		const reminder = coreDB.getReminder(id);
		return { success: true, data: reminder };
	}, {
		body: t.Object({
			title: t.String(),
			remindAt: t.Number(),
			description: t.Optional(t.String()),
			repeat: t.Optional(t.Union([
				t.Literal('daily'),
				t.Literal('weekly'),
				t.Literal('monthly'),
				t.Literal('yearly'),
			])),
		}),
	})
	// Complete reminder
	.post('/:id/complete', ({ params, set }) => {
		const success = coreDB.completeReminder(parseInt(params.id));
		if (!success) {
			set.status = 404;
			return { success: false, error: 'Reminder not found' };
		}
		return { success: true };
	})
	// Delete reminder
	.delete('/:id', ({ params, set }) => {
		const success = coreDB.deleteReminder(parseInt(params.id));
		if (!success) {
			set.status = 404;
			return { success: false, error: 'Reminder not found' };
		}
		return { success: true };
	});

export default reminders;
