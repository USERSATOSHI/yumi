import { ErrorBase } from "@yumi/results";

type Kinds = 'ModelNotFound' | 'ConnectionFailed' | 'InvalidResponse' | 'UnknownError';

export class OllamaError extends ErrorBase<Kinds> {
	static ModelNotFound(message: string) {
		return new OllamaError(`Model not found: ${message}`, 'ModelNotFound');
	}

	static ConnectionFailed(message: string) {
		return new OllamaError(`Connection failed: ${message}`, 'ConnectionFailed');
	}
	
	static InvalidResponse(message: string) {
		return new OllamaError(`Invalid response: ${message}`, 'InvalidResponse');
	}
	
	static UnknownError(message: string) {
		return new OllamaError(`Unknown error: ${message}`, 'UnknownError');
	}
}