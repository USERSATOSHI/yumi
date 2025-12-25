/**
 * Local Module Imports
 */
import { ErrorBase } from '../src/index'; // Adjust path as necessary

// Define a custom error class for testing ErrorBase.match
class CustomAppError extends ErrorBase<'AuthError' | 'NetworkError' | 'ValidationError'> {
	static AuthError(message: string) {
		return new CustomAppError(message, 'AuthError');
	}
	static NetworkError(message: string) {
		return new CustomAppError(message, 'NetworkError');
	}
	static ValidationError(message: string) {
		return new CustomAppError(message, 'ValidationError');
	}
}

describe('ErrorBase', () => {
	it('should correctly set message, name, and kind in constructor', () => {
		const error = new ErrorBase('Test message', 'TestKind');
		expect(error.message).toBe('Test message');
		expect(error.name).toBe('ErrorBase');
		expect(error.kind).toBe('TestKind');
	});

	it('should create a custom error with ErrorBase.Custom', () => {
		const customError = ErrorBase.Custom('Custom error message');
		expect(customError.message).toBe('Custom error message');
		expect(customError.name).toBe('ErrorBase');
		expect(customError.kind).toBe('Custom');
	});

	describe('match method', () => {
		it('should match the specific kind handler if available', () => {
			const authError = CustomAppError.AuthError('Authentication failed');
			const result = authError.match({
				AuthError: (err) => `Handled Auth Error: ${err.message}`,
				NetworkError: (err) => `Handled Network Error: ${err.message}`,
				ValidationError: (err) => `Handled Validation Error: ${err.message}`,
				_: (err) => `Handled Unknown Error: ${err.message}`,
			});
			expect(result).toBe('Handled Auth Error: Authentication failed');
		});

		it('should use the fallback handler if the specific kind is not available', () => {
			const unknownError = ErrorBase.Custom('An unexpected error');
			const result = unknownError.match({
				_: (err) => `Handled Fallback: ${err.message}`,
			});
			expect(result).toBe('Handled Fallback: An unexpected error');
		});

		it('should correctly handle a custom kind that is not explicitly in handlers but matches fallback', () => {
			const myError = new ErrorBase('My specific error', 'MySpecificKind');
			const result = myError.match({
				_: (err) => `Fallback: ${err.kind} - ${err.message}`,
			});
			expect(result).toBe('Fallback: MySpecificKind - My specific error');
		});
	});
});
