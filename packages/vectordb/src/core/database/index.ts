import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Result } from '@yumi/results';
import { CONFIG } from '../../config';
import { DBError } from '../../errors';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
	id: number;
	role: MessageRole;
	content: string;
	embedding: Float32Array;
	createdAt: number;
}

export interface MessageRow {
	id: number;
	role: string;
	content: string;
	embedding: Buffer;
	created_at: number;
}

function float32ToBuffer(arr: Float32Array): Buffer {
	return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

function bufferToFloat32(buf: Buffer): Float32Array {
	const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
	return new Float32Array(arrayBuffer);
}

function rowToMessage(row: MessageRow): Message {
	return {
		id: row.id,
		role: row.role as MessageRole,
		content: row.content,
		embedding: bufferToFloat32(row.embedding),
		createdAt: row.created_at,
	};
}

export class ChatDB {
	private db: Database;
	private insertStmt: ReturnType<Database['prepare']>;
	private getAllStmt: ReturnType<Database['prepare']>;
	private getByIdStmt: ReturnType<Database['prepare']>;
	private getRecentStmt: ReturnType<Database['prepare']>;
	private deleteStmt: ReturnType<Database['prepare']>;

	constructor(dbPath: string = CONFIG.dbPath) {
		mkdirSync(dirname(dbPath), { recursive: true });

		this.db = new Database(dbPath);
		this.setupPragmas();
		this.createSchema();

		this.insertStmt = this.db.prepare(`
			INSERT INTO messages (role, content, embedding, created_at)
			VALUES ($role, $content, $embedding, $createdAt)
		`);

		this.getAllStmt = this.db.prepare(`
			SELECT id, role, content, embedding, created_at 
			FROM messages 
			ORDER BY created_at ASC
		`);

		this.getByIdStmt = this.db.prepare(`
			SELECT id, role, content, embedding, created_at 
			FROM messages 
			WHERE id = $id
		`);

		this.getRecentStmt = this.db.prepare(`
			SELECT id, role, content, embedding, created_at 
			FROM messages 
			ORDER BY created_at DESC 
			LIMIT $limit
		`);

		this.deleteStmt = this.db.prepare(`DELETE FROM messages WHERE id = $id`);
	}

	private setupPragmas() {
		this.db.exec('PRAGMA journal_mode = WAL');
		this.db.exec('PRAGMA synchronous = NORMAL');
		this.db.exec('PRAGMA cache_size = -64000');
		this.db.exec('PRAGMA mmap_size = 268435456');
		this.db.exec('PRAGMA busy_timeout = 5000');
	}

	private createSchema() {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS messages (
				id INTEGER PRIMARY KEY,
				role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
				content TEXT NOT NULL,
				embedding BLOB NOT NULL,
				created_at INTEGER NOT NULL
			)
		`);

		this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at)
		`);

		this.db.exec(`
			CREATE INDEX IF NOT EXISTS idx_messages_role ON messages (role)
		`);
	}

	insert(message: Omit<Message, 'id'>): Result<number, DBError> {
		try {
			this.insertStmt.run({
				$role: message.role,
				$content: message.content,
				$embedding: float32ToBuffer(message.embedding),
				$createdAt: message.createdAt,
			});
			const id = this.db.query('SELECT last_insert_rowid() as id').get() as { id: number };
			return Result.ok(id.id);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return Result.err(DBError.QueryFailed(msg));
		}
	}

	insertMany(messages: Omit<Message, 'id'>[]): Result<number, DBError> {
		try {
			const insertBatch = this.db.transaction((msgs: Omit<Message, 'id'>[]) => {
				for (const message of msgs) {
					this.insertStmt.run({
						$role: message.role,
						$content: message.content,
						$embedding: float32ToBuffer(message.embedding),
						$createdAt: message.createdAt,
					});
				}
				return msgs.length;
			});

			const count = insertBatch(messages);
			return Result.ok(count);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return Result.err(DBError.QueryFailed(msg));
		}
	}

	getAll(): Result<Message[], DBError> {
		try {
			const rows = this.getAllStmt.all() as MessageRow[];
			return Result.ok(rows.map(rowToMessage));
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return Result.err(DBError.QueryFailed(msg));
		}
	}

	getById(id: number): Result<Message | null, DBError> {
		try {
			const row = this.getByIdStmt.get({ $id: id }) as MessageRow | null;
			return Result.ok(row ? rowToMessage(row) : null);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return Result.err(DBError.QueryFailed(msg));
		}
	}

	getRecent(limit: number): Result<Message[], DBError> {
		try {
			const rows = this.getRecentStmt.all({ $limit: limit }) as MessageRow[];
			return Result.ok(rows.map(rowToMessage).reverse());
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return Result.err(DBError.QueryFailed(msg));
		}
	}

	getAllWithEmbeddings(): Result<Message[], DBError> {
		return this.getAll();
	}

	delete(id: number): Result<boolean, DBError> {
		try {
			const result = this.deleteStmt.run({ $id: id });
			return Result.ok(result.changes > 0);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return Result.err(DBError.QueryFailed(msg));
		}
	}

	clear(): Result<number, DBError> {
		try {
			const result = this.db.exec('DELETE FROM messages');
			return Result.ok(result.changes);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return Result.err(DBError.QueryFailed(msg));
		}
	}

	count(): Result<number, DBError> {
		try {
			const row = this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
			return Result.ok(row.count);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return Result.err(DBError.QueryFailed(msg));
		}
	}

	close(): Result<void, DBError> {
		try {
			this.db.close();
			return Result.ok(undefined);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return Result.err(DBError.ConnectionClosed(msg));
		}
	}
}
