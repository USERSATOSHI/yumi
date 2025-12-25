import { ErrorBase } from '@yumi/results';

type ReminderErrorKinds = 
	| 'ReminderNotFound'
	| 'ReminderAlreadyExists'
	| 'InvalidRemindTime'
	| 'TimerFailed';

export class ReminderPoolError extends ErrorBase<ReminderErrorKinds> {
	static readonly ReminderNotFound = new ReminderPoolError('Reminder not found', 'ReminderNotFound');
	static readonly ReminderAlreadyExists = new ReminderPoolError('Reminder with this title already exists', 'ReminderAlreadyExists');
	static readonly InvalidRemindTime = new ReminderPoolError('Remind time must be in the future', 'InvalidRemindTime');
	static readonly TimerFailed = new ReminderPoolError('Failed to set timer for reminder', 'TimerFailed');
}
