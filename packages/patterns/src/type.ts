/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

// Constructor type that supports protected or public constructors
export type GetConstructorParams<T> = T extends {
	new (...args: infer P): any;
}
	? P
	: never;

export type Class<T = any> = typeof EmptyClass & { prototype: T };

export type GetInstanceType<T> = T extends { prototype: infer I } ? I : never;

class EmptyClass {
	protected constructor(...args: any[]) {}
}

export type ClassType = typeof EmptyClass;

export type AnyClass<T extends ClassType = ClassType> = ClassType & {
	prototype: ProtectedInstanceType<T>;
};

export type ConcreteClass<T extends ClassType> = ClassType & {
	prototype: ProtectedInstanceType<T>;
};

export type ProtectedConstructorParameters<T> = ConstructorParameters<{ new (): never } & T>;

export type ProtectedInstanceType<T extends ClassType> = T extends { prototype: infer I }
	? I
	: never;
