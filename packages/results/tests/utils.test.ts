/**
 * Local Module Imports
 */
import { ErrorBase, safeAsync, safeSync } from '../src/index'; // Adjust path as necessary

// Define a custom error for utility function tests
class UtilityError extends ErrorBase<'CustomUtilityError'> {
	constructor(message: string) {
		super(message, 'CustomUtilityError');
		this.name = 'UtilityError';
	}
}

describe('Utility Functions', () => {
	describe('safeSync', () => {
		it('should return Ok for a successful synchronous function', () => {
			const func = (a: number, b: number) => a + b;
			const res = safeSync(func, 1, 2);
			expect(res.isOk()).toBe(true);
			expect(res.unwrap()).toBe(3);
		});

		it('should return Err for a synchronous function that throws an Error', () => {
			const func = (a: number, b: number) => {
				if (b === 0) throw new Error('Cannot divide by zero');
				return a / b;
			};
			const res = safeSync(func, 10, 0);
			expect(res.isErr()).toBe(true);
			expect(res.unwrapErr()?.message).toContain('Cannot divide by zero');
			expect(res.unwrapErr()?.kind).toBe('Custom');
		});

		it('should return Err for a synchronous function that throws a non-Error object', () => {
			const func = () => {
				throw 'Something non-error-like';
			};
			const res = safeSync(func);
			expect(res.isErr()).toBe(true);
			expect(res.unwrapErr()?.message).toBe('Something non-error-like');
			expect(res.unwrapErr()?.kind).toBe('Custom');
		});

		it('should correctly handle built-in functions like JSON.parse', () => {
			const resOk = safeSync(JSON.parse, '{"a":1}');
			expect(resOk.isOk()).toBe(true);
			expect(resOk.unwrap()).toEqual({ a: 1 });

			const resErr = safeSync(JSON.parse, 'invalid json');
			expect(resErr.isErr()).toBe(true);
			expect(resErr.unwrapErr()?.message).toContain('JSON');
			expect(resErr.unwrapErr()?.kind).toBe('Custom');
		});
	});

	describe('safeAsync', () => {
		it('should return Ok for a resolving promise', async () => {
			const promise = Promise.resolve('Async success');
			const res = await safeAsync(promise);
			expect(res.isOk()).toBe(true);
			expect(res.unwrap()).toBe('Async success');
		});

		it('should return Err for a rejecting promise', async () => {
			const promise = Promise.reject(new Error('Async failure'));
			const res = await safeAsync(promise);
			expect(res.isErr()).toBe(true);
			expect(res.unwrapErr()?.message).toContain('Async failure');
			expect(res.unwrapErr()?.kind).toBe('Custom');
		});

		it('should return Err for a promise rejecting with a non-Error object', async () => {
			const promise = Promise.reject('Raw async error');
			const res = await safeAsync(promise);
			expect(res.isErr()).toBe(true);
			expect(res.unwrapErr()?.message).toBe('Raw async error');
			expect(res.unwrapErr()?.kind).toBe('Custom');
		});

		it('should handle async functions that throw', async () => {
			const asyncFunc = async (shouldThrow: boolean) => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				if (shouldThrow) {
					throw new UtilityError('Async specific error');
				}
				return 'Async result';
			};

			const resOk = await safeAsync(asyncFunc(false));
			expect(resOk.isOk()).toBe(true);
			expect(resOk.unwrap()).toBe('Async result');

			const resErr = await safeAsync(asyncFunc(true));
			expect(resErr.isErr()).toBe(true);
			expect(resErr.unwrapErr()?.message).toContain('Async specific error');
			expect(resErr.unwrapErr()?.kind).toBe('Custom'); // safeAsync wraps any rejection reason into ErrorBase.Custom
		});
	});
});
