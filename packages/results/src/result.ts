/**
 * Local Module Imports
 */
import type { ErrorBase } from './err';
import type { Err, Ok, ResultType } from './type';

/**
 * A Result type that represents either success (Ok) or failure (Err).
 * Inspired by Rust's Result type, this provides a functional approach to error handling.
 *
 * @template T The type of the success value
 * @template E The type of the error (must extend Error)
 *
 * @example
 * ```typescript
 * // Creating successful results
 * const success = Result.ok(42);
 * const message = Result.ok("Hello, world!");
 *
 * // Creating error results
 * const failure = Result.err(new Error("Something went wrong"));
 *
 * // Using pattern matching
 * const result = divide(10, 2);
 * const output = result.match({
 *   ok: (value) => `Result: ${value}`,
 *   err: (error) => `Error: ${error.message}`
 * });
 * ```
 */
export class Result<T, E extends ErrorBase> {
	readonly value: Ok<T> | Err<E>;

	private constructor(value: ResultType<T, E>) {
		this.value = value;
	}

	// ============================================================================
	// Constructors
	// ============================================================================

	/**
	 * Creates a successful Result containing the given value.
	 *
	 * @param data The success value to wrap
	 * @returns A Result representing success
	 *
	 * @example
	 * ```typescript
	 * const result = Result.ok(42);
	 * console.log(result.isOk()); // true
	 * console.log(result.unwrap()); // 42
	 * ```
	 */
	static ok<T, E extends ErrorBase = ErrorBase>(data: T): Result<T, E> {
		return new Result({ success: true, data });
	}

	/**
	 * Creates a failed Result containing the given error.
	 *
	 * @param error The error to wrap
	 * @returns A Result representing failure
	 *
	 * @example
	 * ```typescript
	 * const result = Result.err(new Error("Failed"));
	 * console.log(result.isErr()); // true
	 * console.log(result.unwrapErr()?.message); // "Failed"
	 * ```
	 */
	static err<T, E extends ErrorBase>(error: E): Result<T, E> {
		return new Result({ success: false, error });
	}

	// ============================================================================
	// Type Guards
	// ============================================================================

	/**
	 * Type guard to check if this Result represents success.
	 *
	 * @returns true if this Result contains a success value
	 *
	 * @example
	 * ```typescript
	 * const result = Result.ok(42);
	 * if (result.isOk()) {
	 *   console.log(result.value.data); // TypeScript knows this is safe
	 * }
	 * ```
	 */
	isOk(): this is { value: Ok<T> } {
		return this.value.success;
	}

	/**
	 * Type guard to check if this Result represents failure.
	 *
	 * @returns true if this Result contains an error
	 *
	 * @example
	 * ```typescript
	 * const result = Result.err(new Error("Failed"));
	 * if (result.isErr()) {
	 *   console.log(result.value.error.message); // TypeScript knows this is safe
	 * }
	 * ```
	 */
	isErr(): this is { value: Err<E> } {
		return !this.value.success;
	}

	// ============================================================================
	// Unwrapping Methods
	// ============================================================================

	/**
	 * Returns the success value if Ok, otherwise returns undefined.
	 * Use this when you want to safely extract the value without throwing.
	 *
	 * @returns The success value or undefined
	 *
	 * @example
	 * ```typescript
	 * const success = Result.ok(42);
	 * const failure = Result.err(new Error("Failed"));
	 *
	 * console.log(success.unwrap()); // 42
	 * console.log(failure.unwrap()); // undefined
	 * ```
	 */
	unwrap(): T | undefined {
		return this.isOk() ? this.value.data : undefined;
	}

	/**
	 * Returns the error if Err, otherwise returns undefined.
	 *
	 * @returns The error or undefined
	 *
	 * @example
	 * ```typescript
	 * const success = Result.ok(42);
	 * const failure = Result.err(new Error("Failed"));
	 *
	 * console.log(success.unwrapErr()); // undefined
	 * console.log(failure.unwrapErr()?.message); // "Failed"
	 * ```
	 */
	unwrapErr(): E | undefined {
		return this.isErr() ? this.value.error : undefined;
	}

	/**
	 * Returns the success value if Ok, otherwise returns the provided default value.
	 *
	 * @param defaultValue The value to return if this Result is Err
	 * @returns The success value or the default value
	 *
	 * @example
	 * ```typescript
	 * const success = Result.ok(42);
	 * const failure = Result.err(new Error("Failed"));
	 *
	 * console.log(success.unwrapOr(0)); // 42
	 * console.log(failure.unwrapOr(0)); // 0
	 * ```
	 */
	unwrapOr(defaultValue: T): T {
		return this.isOk() ? this.value.data : defaultValue;
	}

	// ============================================================================
	// Transformation Methods
	// ============================================================================

	/**
	 * Maps the success value through a function, leaving errors unchanged.
	 *
	 * @param fn Function to transform the success value
	 * @returns A new Result with the transformed value or the original error
	 *
	 * @example
	 * ```typescript
	 * const result = Result.ok(42);
	 * const doubled = result.map(x => x * 2);
	 * console.log(doubled.unwrap()); // 84
	 *
	 * const error = Result.err(new Error("Failed"));
	 * const stillError = error.map(x => x * 2);
	 * console.log(stillError.isErr()); // true
	 * ```
	 */
	map<U>(fn: (val: T) => U): Result<U, E> {
		return this.value.success ? Result.ok(fn(this.value.data)) : Result.err(this.value.error);
	}

	/**
	 * Maps the error through a function, leaving success values unchanged.
	 *
	 * @param fn Function to transform the error
	 * @returns A new Result with the original value or the transformed error
	 *
	 * @example
	 * ```typescript
	 * const result = Result.err(new Error("Original"));
	 * const mapped = result.mapErr(err => new Error(`Wrapped: ${err.message}`));
	 * console.log(mapped.unwrapErr()?.message); // "Wrapped: Original"
	 * ```
	 */
	mapErr<F extends ErrorBase>(fn: (err: E) => F): Result<T, F> {
		return !this.value.success ? Result.err(fn(this.value.error)) : Result.ok(this.value.data);
	}

	// ============================================================================
	// Monadic Operations
	// ============================================================================

	/**
	 * Chains together operations that return Results.
	 * If this Result is Ok, applies the function to the value.
	 * If this Result is Err, returns the error without calling the function.
	 *
	 * @param fn Function that takes the success value and returns a new Result
	 * @returns The Result returned by fn, or the original error
	 *
	 * @example
	 * ```typescript
	 * const divide = (a: number, b: number): Result<number, Error> =>
	 *   b === 0 ? Result.err(new Error("Division by zero")) : Result.ok(a / b);
	 *
	 * const result = Result.ok(10)
	 *   .andThen(x => divide(x, 2))
	 *   .andThen(x => divide(x, 2));
	 *
	 * console.log(result.unwrap()); // 2.5
	 * ```
	 */
	andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
		return this.value.success ? fn(this.value.data) : Result.err(this.value.error);
	}

	/**
	 * Provides a way to recover from errors by applying a function to the error.
	 * If this Result is Err, applies the function to the error.
	 * If this Result is Ok, returns the success value unchanged.
	 *
	 * @param fn Function that takes the error and returns a new Result
	 * @returns The Result returned by fn, or the original success value
	 *
	 * @example
	 * ```typescript
	 * const result = Result.err(new Error("Network error"))
	 *   .orElse(err => {
	 *     if (err.message.includes("Network")) {
	 *       return Result.ok("Using cached data");
	 *     }
	 *     return Result.err(err);
	 *   });
	 *
	 * console.log(result.unwrap()); // "Using cached data"
	 * ```
	 */
	orElse<F extends ErrorBase>(fn: (error: E) => Result<T, F>): Result<T, F> {
		return !this.value.success ? fn(this.value.error) : Result.ok(this.value.data);
	}

	// ============================================================================
	// Pattern Matching
	// ============================================================================

	/**
	 * Pattern matching over the Result. Applies the appropriate handler based on
	 * whether this Result is Ok or Err.
	 *
	 * @param handlers Object with ok and err handler functions
	 * @returns The result of calling the appropriate handler
	 *
	 * @example
	 * ```typescript
	 * const result = Result.ok(42);
	 * const message = result.match({
	 *   ok: (value) => `Success: ${value}`,
	 *   err: (error) => `Error: ${error.message}`
	 * });
	 * console.log(message); // "Success: 42"
	 * ```
	 */
	match<U>(handlers: { ok: (val: T) => U; err: (err: E) => U }): U {
		return this.value.success ? handlers.ok(this.value.data) : handlers.err(this.value.error);
	}

	// ============================================================================
	// Utility Methods
	// ============================================================================

	/**
	 * Provides raw access to the underlying value structure.
	 * Generally not needed in typical usage, but available for advanced use cases.
	 *
	 * @returns The raw ResultType value
	 *
	 * @example
	 * ```typescript
	 * const result = Result.ok(42);
	 * const raw = result.raw;
	 * console.log(raw.success); // true
	 * if (raw.success) {
	 *   console.log(raw.data); // 42
	 * }
	 * ```
	 */
	get raw(): ResultType<T, E> {
		return this.value;
	}

	/**
	 * Returns a string representation of this Result for debugging purposes.
	 */
	toString(): string {
		return this.value.success
			? `Result.Ok(${this.value.data})`
			: `Result.Err(${this.value.error.message})`;
	}

	errAs<Kind extends string, NewErr extends ErrorBase<Kind>>(
		err: NewErr | ((message: string) => NewErr),
	): Result<T, NewErr> {
		// @ts-expect-error: this is fine.
		const newError = typeof err === 'function' ? err(this.value.error?.message) : err;
		return this.isOk()
			? new Result({ success: true, data: this.value.data })
			: (new Result({ success: false, error: newError }) as Result<T, NewErr>);
	}
}
