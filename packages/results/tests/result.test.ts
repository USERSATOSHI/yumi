/**
 * Local Module Imports
 */
import { Err, ErrorBase, Ok, Result } from '../src/index'; // Adjust path as necessary

// Define a simple custom error for Result tests
class MyResultError extends ErrorBase<'TestError'> {
	constructor(message: string) {
		super(message, 'TestError');
		this.name = 'MyResultError';
	}
}

describe('Result', () => {
	describe('ok static method', () => {
		it('should create an Ok Result', () => {
			const res = Result.ok(123);
			expect(res.isOk()).toBe(true);
			expect(res.isErr()).toBe(false);
			expect((res.value as Ok<number>).data).toBe(123);
		});
	});

	describe('err static method', () => {
		it('should create an Err Result', () => {
			const error = new MyResultError('Something went wrong');
			const res = Result.err<number, MyResultError>(error);
			expect(res.isErr()).toBe(true);
			expect(res.isOk()).toBe(false);
			expect((res.value as Err<MyResultError>).error).toBe(error);
		});
	});

	describe('unwrap', () => {
		it('should return data for Ok Result', () => {
			const res = Result.ok('hello');
			expect(res.unwrap()).toBe('hello');
		});

		it('should return undefined for Err Result', () => {
			const res = Result.err<string, MyResultError>(new MyResultError('Error'));
			expect(res.unwrap()).toBeUndefined();
		});
	});

	describe('unwrapErr', () => {
		it('should return error for Err Result', () => {
			const error = new MyResultError('Error message');
			const res = Result.err<number, MyResultError>(error);
			expect(res.unwrapErr()).toBe(error);
		});

		it('should return undefined for Ok Result', () => {
			const res = Result.ok(123);
			expect(res.unwrapErr()).toBeUndefined();
		});
	});

	describe('unwrapOr', () => {
		it('should return data for Ok Result', () => {
			const res = Result.ok(42);
			expect(res.unwrapOr(0)).toBe(42);
		});

		it('should return default value for Err Result', () => {
			const res = Result.err<number, MyResultError>(new MyResultError('Error'));
			expect(res.unwrapOr(0)).toBe(0);
		});
	});

	describe('map', () => {
		it('should transform data for Ok Result', () => {
			const res = Result.ok(5).map((x) => x * 2);
			expect(res.isOk()).toBe(true);
			expect(res.unwrap()).toBe(10);
		});

		it('should not transform error for Err Result', () => {
			const error = new MyResultError('Original error');
			const res = Result.err<number, MyResultError>(error).map((x) => x * 2);
			expect(res.isErr()).toBe(true);
			expect(res.unwrapErr()).toBe(error);
		});
	});

	describe('mapErr', () => {
		it('should transform error for Err Result', () => {
			class NewError extends ErrorBase<'NewKind'> {
				constructor() {
					super('New error', 'NewKind');
				}
			}
			const originalError = new MyResultError('Original error');
			const res = Result.err<number, MyResultError>(originalError).mapErr(
				() => new NewError(),
			);
			expect(res.isErr()).toBe(true);
			expect(res.unwrapErr()).toBeInstanceOf(NewError);
			expect(res.unwrapErr()?.message).toBe('New error');
		});

		it('should not transform data for Ok Result', () => {
			class NewError extends ErrorBase<'NewKind'> {
				constructor() {
					super('New error', 'NewKind');
				}
			}
			const res = Result.ok<number, MyResultError>(10).mapErr(() => new NewError());
			expect(res.isOk()).toBe(true);
			expect(res.unwrap()).toBe(10);
		});
	});

	describe('andThen', () => {
		const divide = (a: number, b: number): Result<number, MyResultError> =>
			b === 0 ? Result.err(new MyResultError('Division by zero')) : Result.ok(a / b);

		it('should chain operations for Ok Result', () => {
			const res = Result.ok(10)
				.andThen((x) => divide(x, 2))
				.andThen((x) => divide(x, 2));
			expect(res.isOk()).toBe(true);
			expect(res.unwrap()).toBe(2.5);
		});

		it('should short-circuit on first Err Result', () => {
			const res = Result.ok(10)
				.andThen((x) => divide(x, 0)) // This will be an error
				.andThen((x) => divide(x, 2)); // This should not be called
			expect(res.isErr()).toBe(true);
			expect(res.unwrapErr()?.message).toBe('Division by zero');
		});
	});

	describe('orElse', () => {
		const recover = (err: MyResultError): Result<string, ErrorBase> => {
			if (err.message === 'Network error') {
				return Result.ok('Recovered with cached data');
			}
			return Result.err(ErrorBase.Custom('Unhandled error'));
		};

		it('should recover from Err Result', () => {
			const res = Result.err<string, MyResultError>(
				new MyResultError('Network error'),
			).orElse(recover);
			expect(res.isOk()).toBe(true);
			expect(res.unwrap()).toBe('Recovered with cached data');
		});

		it('should not recover if handler returns Err', () => {
			const res = Result.err<string, MyResultError>(
				new MyResultError('Unknown error'),
			).orElse(recover);
			expect(res.isErr()).toBe(true);
			expect(res.unwrapErr()?.message).toBe('Unhandled error');
		});

		it('should not call handler for Ok Result', () => {
			const res = Result.ok<string, MyResultError>('Success').orElse(recover);
			expect(res.isOk()).toBe(true);
			expect(res.unwrap()).toBe('Success');
		});
	});

	describe('match', () => {
		it('should call ok handler for Ok Result', () => {
			const res = Result.ok(10);
			const output = res.match({
				ok: (val) => `Success: ${val}`,
				err: (err) => `Error: ${err.message}`,
			});
			expect(output).toBe('Success: 10');
		});

		it('should call err handler for Err Result', () => {
			const res = Result.err<number, MyResultError>(new MyResultError('Failed operation'));
			const output = res.match({
				ok: (val) => `Success: ${val}`,
				err: (err) => `Error: ${err.message}`,
			});
			expect(output).toBe('Error: Failed operation');
		});
	});

	describe('raw getter', () => {
		it('should return the raw Ok value', () => {
			const res = Result.ok(123);
			expect(res.raw).toEqual({ success: true, data: 123 });
		});

		it('should return the raw Err value', () => {
			const error = new MyResultError('Raw error');
			const res = Result.err<number, MyResultError>(error);
			expect(res.raw).toEqual({ success: false, error: error });
		});
	});

	describe('toString', () => {
		it('should return string representation for Ok Result', () => {
			const res = Result.ok('data');
			expect(res.toString()).toBe('Result.Ok(data)');
		});

		it('should return string representation for Err Result', () => {
			const res = Result.err<string, MyResultError>(new MyResultError('fail'));
			expect(res.toString()).toBe('Result.Err(fail)');
		});
	});
});
