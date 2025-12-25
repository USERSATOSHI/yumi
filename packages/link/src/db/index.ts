import { Database } from 'bun:sqlite';

import { Singleton } from '@yumi/patterns';
import { ErrorBase, Result } from '@yumi/results';
import type { DeviceData } from './type.js';
import { DBError } from './error.js';

export class DB extends Database {
	#db = new Database('db.sqlite', { create: true });

	constructor() {
		super();
		this.#init();
	}

	#init() {
		this.#db.exec(`
			CREATE TABLE IF NOT EXISTS device (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				type TEXT NOT NULL,
				hash TEXT NOT NULL UNIQUE
			);		
		`);
	}

	getOrCreateDevice(): Result<DeviceData, DBError> {
		const devices = this.#db.prepare('SELECT * FROM device').get() as DeviceData | undefined;

		if (devices) {
			return Result.ok(devices);
		}

		const name = prompt('Enter device name: ');
		const type = prompt('Enter device type: ');
		const hash = crypto.randomUUID();

		if (!name || !type) {
			return Result.err(DBError.MissingNameOrType);
		}

		const insert = this.#db.prepare('INSERT INTO device (name, type, hash) VALUES (?, ?, ?)');
		const result = insert.run(name, type, hash);

		if (result.changes === 0) {
			return Result.err(DBError.InsertionFailed);
		}

		const newDevice: DeviceData = {
			id: Number(result.lastInsertRowid),
			name,
			type,
			hash,
		};

		return Result.ok(newDevice);
	}
}