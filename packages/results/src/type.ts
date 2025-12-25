/**
 * Local Module Imports
 */
import type { ErrorBase } from './err';

export type Ok<T> = { success: true; data: T };
export type Err<E extends ErrorBase> = { success: false; error: E };
export type ResultType<T, E extends ErrorBase> = Ok<T> | Err<E>;
export type WithFallback<T extends string> = T | '_' | 'Custom';
