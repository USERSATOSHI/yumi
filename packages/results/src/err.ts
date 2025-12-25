/**
 * Local Module Imports
 */
import type { WithFallback } from './type';

export class ErrorBase<Kinds extends string = string> extends Error {
	override name: string;
	readonly kind: Kinds;

	static Custom(message: string) {
		return new ErrorBase(message, 'Custom');
	}

	constructor(message: string, kind: Kinds) {
		super(message);
		this.name = new.target.name;
		this.kind = kind;
	}

	match<T>(handlers: { [Kind in WithFallback<Kinds>]?: (err: this) => T }): T {
		if (this.kind in handlers) {
			return handlers[this.kind]!(this);
		}

		return handlers._!(this);
	}
}
