/**
 * Local Module Imports
 */
import type {
	AnyClass,
	Class,
	ClassType,
	ConcreteClass,
	GetInstanceType,
	ProtectedConstructorParameters,
	ProtectedInstanceType,
} from './type';

/**
 * A base class for implementing the Singleton pattern.
 *
 * Extend this class to ensure only one instance of your class exists.
 *
 * @example
 * ```ts
 * // Without constructor params
 * class AppConfig extends Singleton {
 *   protected constructor() { super(); }
 * }
 * const config = AppConfig.getInstance();
 *
 * // With constructor params
 * class Database extends Singleton {
 *   protected constructor(public url: string) { super(); }
 * }
 * const db = Database.getInstance("postgres://localhost");
 * const sameDb = Database.getInstance(); // Returns existing instance
 * ```
 */
export abstract class Singleton {
	/** Stores all singleton instances, keyed by their class */
	private static instances = new Map<AnyClass, ProtectedInstanceType<AnyClass>>();

	protected constructor() {}

	/**
	 * Gets the singleton instance, creating it if it doesn't exist.
	 *
	 * - First call: Pass constructor arguments to create the instance
	 * - Subsequent calls: No arguments needed, returns existing instance
	 */
	public static getInstance<TClass extends Class>(this: TClass): GetInstanceType<TClass>;
	public static getInstance<TClass extends Class>(
		this: TClass,
		...args: ProtectedConstructorParameters<TClass>
	): GetInstanceType<TClass>;
	public static getInstance<TClass extends Class>(
		this: TClass,
		...args: ProtectedConstructorParameters<TClass>
	): GetInstanceType<TClass> {
		if (!Singleton.instances.has(this)) {
			const Constructor = this as unknown as new (
				...args: ProtectedConstructorParameters<TClass>
			) => GetInstanceType<TClass>;

			Singleton.instances.set(this, new Constructor(...args));
		}

		return Singleton.instances.get(this) as GetInstanceType<TClass>;
	}

	/** Access all singleton instances (for debugging/testing) */
	get instances() {
		return Singleton.instances;
	}

	/** Clears all singleton instances */
	protected static clearInstances(): void {
		Singleton.instances.clear();
	}

	/** Checks if an instance exists for the given class */
	protected static hasInstance<T extends ClassType>(constructor: ConcreteClass<T>): boolean {
		return Singleton.instances.has(constructor);
	}

	/** Returns how many singletons have been created */
	protected static getInstanceCount(): number {
		return Singleton.instances.size;
	}
}
