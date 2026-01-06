import { ErrorBase } from '@yumi/results';

type Kinds =
	| 'ModelNotFound'
	| 'ConnectionFailed'
	| 'InvalidResponse'
	| 'UnknownError';

export class ToolClassifierError extends ErrorBase<Kinds> {
	static ModelNotFound(message: string) {
		return new ToolClassifierError(
			`Model not found: ${message}`,
			'ModelNotFound',
		);
	}

	static ConnectionFailed(message: string) {
		return new ToolClassifierError(
			`Connection failed: ${message}`,
			'ConnectionFailed',
		);
	}

	static InvalidResponse(message: string) {
		return new ToolClassifierError(
			`Invalid response: ${message}`,
			'InvalidResponse',
		);
	}

	static UnknownError(message: string) {
		return new ToolClassifierError(
			`Unknown error: ${message}`,
			'UnknownError',
		);
	}
}
