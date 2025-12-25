import { ErrorBase } from "@yumi/results";

type Kinds = 'ModelNotFound' | 'ConnectionFailed' | 'InvalidResponse' | 'UnknownError';

export class ToolCallError extends ErrorBase<Kinds> {
	static ModelNotFound(message: string) {
		return new ToolCallError(`Model not found: ${message}`, 'ModelNotFound');
	}

	static ConnectionFailed(message: string) {
		return new ToolCallError(`Connection failed: ${message}`, 'ConnectionFailed');
	}
	
	static InvalidResponse(message: string) {
		return new ToolCallError(`Invalid response: ${message}`, 'InvalidResponse');
	}
	
	static UnknownError(message: string) {
		return new ToolCallError(`Unknown error: ${message}`, 'UnknownError');
	}
}