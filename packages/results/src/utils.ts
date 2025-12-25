/**
 * Local Module Imports
 */
import { ErrorBase } from './err';
import { Result } from './result';

/**
 * Safely executes a function with arguments, catching any errors and returning a Result.
 * Type-safe version that preserves function signature and argument types.
 *
 * @param fn The function to execute safely
 * @param args The arguments to pass to the function (type-safe)
 * @returns A Result containing the function result or error
 *
 * @example
 * ```typescript
 * // Basic usage with built-in functions
 * const parseResult = safeSync(JSON.parse, '{"name": "John"}');
 * parseResult.match({
 *   ok: (data) => console.log(data.name), // "John"
 *   err: (error) => console.error('Parse failed:', error.message)
 * });
 *
 * // With parseInt
 * const numberResult = safeSync(parseInt, "123", 10);
 * console.log(numberResult.unwrap()); // 123
 *
 * // With custom functions
 * const divide = (a: number, b: number) => {
 *   if (b === 0) throw new Error("Division by zero");
 *   return a / b;
 * };
 *
 * const divisionResult = safeSync(divide, 10, 2);
 * console.log(divisionResult.unwrap()); // 5
 *
 * const errorResult = safeSync(divide, 10, 0);
 * console.log(errorResult.unwrapErr()?.message); // "Division by zero"
 *
 * // Array methods
 * const arr = [1, 2, 3];
 * const atResult = safeSync(arr.at.bind(arr), 10); // Safe array access
 * console.log(atResult.unwrap()); // undefined (no error thrown)
 *
 * // File system operations (Node.js)
 * import { readFileSync } from 'fs';
 * const fileResult = safeSync(readFileSync, 'nonexistent.txt', 'utf8');
 * fileResult.match({
 *   ok: (content) => console.log(content),
 *   err: (error) => console.error('File read failed:', error.message)
 * });
 *
 * // Type safety examples - these would cause TypeScript errors:
 * // safeSync(parseInt, 123); // Error: string expected for first param
 * // safeSync(divide, "10", 2); // Error: number expected
 * // safeSync(JSON.parse, 123); // Error: string expected
 * ```
 */
export function safeSync<TArgs extends readonly unknown[], TReturn>(
	fn: (...args: TArgs) => TReturn,
	...args: TArgs
): Result<TReturn, ErrorBase> {
	try {
		const result = fn(...args);
		return Result.ok(result);
	} catch (error) {
		return Result.err(ErrorBase.Custom(String(error)));
	}
}

/**
 * Safely awaits a Promise and wraps the result in a Result type.
 * Uses Promise.allSettled internally for a more functional approach without try-catch.
 *
 * @param promise The Promise to await safely
 * @returns A Promise that resolves to a Result containing the Promise result or error
 *
 * @example
 * ```typescript
 * // With fetch - much cleaner!
 * const fetchResult = await safeAsync(fetch('https://api.example.com/data'));
 * fetchResult.match({
 *   ok: async (response) => {
 *     const jsonResult = await safeAsync(response.json());
 *     jsonResult.match({
 *       ok: (data) => console.log(data),
 *       err: (error) => console.error('JSON parse failed:', error.message)
 *     });
 *   },
 *   err: (error) => console.error('Fetch failed:', error.message)
 * });
 *
 * // With custom async operations
 * const asyncDivide = async (a: number, b: number): Promise<number> => {
 *   await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async work
 *   if (b === 0) throw new Error("Division by zero");
 *   return a / b;
 * };
 *
 * const asyncResult = await safeAsync(asyncDivide(10, 2));
 * console.log(asyncResult.unwrap()); // 5
 *
 * const errorResult = await safeAsync(asyncDivide(10, 0));
 * console.log(errorResult.unwrapErr()?.message); // "Division by zero"
 *
 * // With file operations
 * import { readFile } from 'fs/promises';
 * const fileResult = await safeAsync(readFile('package.json', 'utf8'));
 * fileResult.match({
 *   ok: (content) => console.log('File content:', content),
 *   err: (error) => console.error('Failed to read file:', error.message)
 * });
 *
 * // Chaining async operations
 * const chainedResult = await safeAsync(
 *   fetch('/api/user/123')
 *     .then(response => response.json())
 *     .then(user => fetch(`/api/users/${user.id}/posts`))
 *     .then(response => response.json())
 * );
 * ```
 */
export async function safeAsync<T>(promise: Promise<T>): Promise<Result<T, ErrorBase>> {
	const [settled] = await Promise.allSettled([promise]);

	if (settled.status === 'fulfilled') {
		return Result.ok(settled.value);
	} else {
		const error = ErrorBase.Custom(String(settled.reason));
		return Result.err(error);
	}
}

export function safeSyncClass<
	TArgs extends readonly unknown[],
	TClass extends new (...args: TArgs) => TClass,
>(ClassConstructor: TClass, ...args: TArgs): Result<TClass, ErrorBase> {
	try {
		const result = new ClassConstructor(...args);
		return Result.ok(result);
	} catch (error) {
		return Result.err(ErrorBase.Custom(String(error)));
	}
}

/**
 * Safely executes a synchronous function, catching any errors and wrapping the result in a Result type.
 * This overload is used when the function returns a non-Promise value.
 *
 * @template TArgs - The argument types of the function (inferred automatically)
 * @template TReturn - The return type of the function (must not be a Promise)
 *
 * @param fn - The synchronous function to execute safely
 * @param args - Arguments to pass to the function (type-safe)
 *
 * @returns Result<TReturn, Error> - A Result containing either the success value or an error
 *
 * @example
 * ```typescript
 * // JSON parsing
 * const parseResult = safe(JSON.parse, '{"name": "John"}');
 * parseResult.match({
 *   ok: (data) => console.log(data.name), // "John"
 *   err: (error) => console.error('Parse failed:', error.message)
 * });
 *
 * // Number conversion
 * const numberResult = safe(parseInt, "123", 10);
 * console.log(numberResult.unwrap()); // 123
 *
 * // Custom function with validation
 * const divide = (a: number, b: number) => {
 *   if (b === 0) throw new Error("Division by zero");
 *   return a / b;
 * };
 *
 * const result = safe(divide, 10, 2);
 * console.log(result.unwrap()); // 5
 * ```
 */
export function safe<TArgs extends readonly unknown[], TReturn>(
	fn: (...args: TArgs) => TReturn,
	...args: TArgs
): Result<TReturn, ErrorBase>;
/**
 * Safely awaits a Promise, catching any rejections and wrapping the result in a Result type.
 * This overload is used when passing a Promise directly instead of a function.
 *
 * @template T - The resolved type of the Promise
 *
 * @param promise - The Promise to await safely
 *
 * @returns Promise<Result<T, Error>> - A Promise that resolves to a Result containing either the resolved value or an error
 *
 * @example
 * ```typescript
 * // Direct Promise handling
 * const simpleResult = await safe(Promise.resolve(42));
 * console.log(simpleResult.unwrap()); // 42
 *
 * // Promise chains
 * const chainResult = await safe(
 *   fetch('/api/user/123')
 *     .then(response => response.json())
 *     .then(user => fetch(`/api/users/${user.id}/posts`))
 *     .then(response => response.json())
 * );
 *
 * chainResult.match({
 *   ok: (posts) => console.log(`Found ${posts.length} posts`),
 *   err: (error) => console.error('Chain failed:', error.message)
 * });
 *
 * // Existing promises from other libraries
 * const existingPromise = someLibrary.getData();
 * const safeResult = await safe(existingPromise);
 * ```
 */
export function safe<T>(promise: Promise<T>): Promise<Result<T, ErrorBase>>;

/**
 * Implementation of the unified safe function. This is the actual function body that handles
 * the runtime logic for all overloads. It automatically determines whether to use synchronous
 * or asynchronous error handling based on the input type.
 *
 * @template TArgs - The argument types of the function (inferred automatically)
 * @template TReturn - The return type of the function or Promise resolution type
 *
 * @param fnOrPromise - Either a function to execute safely, or a Promise to await safely
 * @param args - Arguments to pass to the function (only used when fnOrPromise is a function)
 *
 * @returns Result<TReturn, Error> | Promise<Result<TReturn, Error>> - The return type depends on the input:
 *   - For functions returning non-Promise values: Result<TReturn, Error>
 *   - For functions returning Promises: Promise<Result<TReturn, Error>>
 *   - For direct Promises: Promise<Result<TReturn, Error>>
 *
 * @internal This is the implementation function. Users should rely on the overloaded signatures
 * for proper type checking and IntelliSense support.
 *
 * @example
 * ```typescript
 * // This function is called automatically based on the overloads:
 *
 * // Calls safeSync internally
 * const syncResult = safe(JSON.parse, '{"test": true}');
 *
 * // Calls safeAsync internally
 * const asyncResult = await safe(fetch('/api/data'));
 *
 * // Calls safeAsync internally
 * const promiseResult = await safe(Promise.resolve("hello"));
 * ```
 */
export function safe<TArgs extends readonly unknown[], TReturn>(
	fnOrPromise: ((...args: TArgs) => TReturn) | Promise<TReturn>,
	...args: TArgs
): Result<TReturn, ErrorBase> | Promise<Result<TReturn, ErrorBase>> {
	if (typeof fnOrPromise === 'function') {
		return safeSync(fnOrPromise, ...args);
	}
	return safeAsync(fnOrPromise);
}
