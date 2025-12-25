import { ErrorBase } from '@yumi/results';

type TodoErrorKinds = 
	| 'TodoNotFound'
	| 'TodoAlreadyExists'
	| 'InvalidPriority';

export class TodoPoolError extends ErrorBase<TodoErrorKinds> {
	static readonly TodoNotFound = new TodoPoolError('Todo not found', 'TodoNotFound');
	static readonly TodoAlreadyExists = new TodoPoolError('Todo with this title already exists', 'TodoAlreadyExists');
	static readonly InvalidPriority = new TodoPoolError('Invalid priority value', 'InvalidPriority');
}
