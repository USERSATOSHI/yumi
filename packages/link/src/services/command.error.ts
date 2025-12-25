import { ErrorBase } from '@yumi/results';

type Kinds =
	| 'InvalidCommand'
	| 'CommandExecutionFailed'
	| 'FFIError'
	| 'NativeMessageFailed'
	| 'MediaControlUnavailable'
	| 'DeviceControlUnavailable';

export class CommandError extends ErrorBase<Kinds> {
	static InvalidCommand(command: string) {
		return new CommandError(`Invalid command: ${command}`, 'InvalidCommand');
	}

	static CommandExecutionFailed(command: string) {
		return new CommandError(`Command execution failed: ${command}`, 'CommandExecutionFailed');
	}

	static FFIError(message: string) {
		return new CommandError(`FFI error: ${message}`, 'FFIError');
	}

	static NativeMessageFailed(message: string) {
		return new CommandError(`Native message failed: ${message}`, 'NativeMessageFailed');
	}

	static readonly MediaControlUnavailable = new CommandError(
		'Media control is not available',
		'MediaControlUnavailable',
	);

	static readonly DeviceControlUnavailable = new CommandError(
		'Device control is not available',
		'DeviceControlUnavailable',
	);
}
