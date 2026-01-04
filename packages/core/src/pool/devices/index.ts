import { Singleton } from "@yumi/patterns";
import { Result } from "@yumi/results";


import { PoolError } from "./error.js";
import { statDB } from "../../db/index.js";

export enum DeviceType {
	Link = 'link',
	Deck = 'deck',
	Server = 'server',
}

export type Device = {
	hash: string;
	name: string;
	type: DeviceType;
	identifier: string;
	status?: 'online' | 'offline';
}

export class Pool extends Singleton {
	#devices: Map<string, Device> = new Map();

	add(wsId: string, device: Device): Result<Device, PoolError> {
		if (this.#devices.has(wsId)) {
			return Result.err(PoolError.DeviceExists);
		}

		this.#devices.set(wsId, device);
		statDB.registerDevice(device.hash, device.name, device.type);
		return Result.ok(device);
	}

	get(wsId: string): Result<Device, PoolError> {
		const device = this.#devices.get(wsId);
		if (!device) {
			return Result.err(PoolError.DeviceNotFound);
		}

		return Result.ok(device);
	}

	remove(wsId: string): Result<Device, PoolError> {
		const device = this.#devices.get(wsId);
		if (!device) {
			return Result.err(PoolError.DeviceNotFound);
		}

		this.#devices.delete(wsId);
		return Result.ok(device);
	}

	has(wsId: string): boolean {
		return this.#devices.has(wsId);
	}

	list(): Device[] {
		return Array.from(this.#devices.values());
	}

	findByHash(hash: string): Result<Device, PoolError> {
		for (const device of this.#devices.values()) {
			if (device.hash === hash) {
				return Result.ok(device);
			}
		}
		return Result.err(PoolError.DeviceNotFound);
	}

	get decks(): Device[] {
		return this.list().filter(device => device.type === DeviceType.Deck);
	}

	get links(): Device[] {
		return this.list().filter(device => device.type === DeviceType.Link);
	}

	get servers(): Device[] {
		return this.list().filter(device => device.type === DeviceType.Server);
	}

	get count(): number {
		return this.#devices.size;
	}

	clear(): void {
		this.#devices.clear();
	}
}

export const devicePool = Pool.getInstance();
