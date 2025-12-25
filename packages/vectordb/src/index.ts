import { Result } from '@yumi/results';
import { CONFIG } from './config';
import { ChatDB, type Message, type MessageRole } from './core/database';
import { Embedder } from './core/embed';
import { SearchEngine, type SearchResult } from './core/search-engine';
import { DBError } from './errors';

export { CONFIG } from './config';
export { ChatDB, type Message, type MessageRole } from './core/database';
export { Embedder } from './core/embed';
export { SearchEngine, type SearchResult } from './core/search-engine';
export { DBError } from './errors';

export class VectorDB {
	private db: ChatDB;
	private embedder: Embedder;
	private search: SearchEngine;

	constructor(dbPath: string = CONFIG.dbPath) {
		this.db = new ChatDB(dbPath);
		this.embedder = new Embedder();
		this.search = new SearchEngine(this.db, this.embedder);
	}

	async warmup(): Promise<Result<void, DBError>> {
		return this.embedder.warmup();
	}

	async addMessage(role: MessageRole, content: string): Promise<Result<Message, DBError>> {
		const embeddingResult = await this.embedder.embed(content);

		if (embeddingResult.isErr()) {
			return Result.err(embeddingResult.unwrapErr()!);
		}

		const embedding = embeddingResult.unwrap()!;
		const createdAt = Date.now();

		const insertResult = this.db.insert({ role, content, embedding, createdAt });

		if (insertResult.isErr()) {
			return Result.err(insertResult.unwrapErr()!);
		}

		return Result.ok({ id: insertResult.unwrap()!, role, content, embedding, createdAt });
	}

	async findSimilar(query: string, topK?: number): Promise<Result<SearchResult[], DBError>> {
		return this.search.search(query, topK);
	}

	async getContext(query: string, topK?: number, recentCount?: number): Promise<Result<Message[], DBError>> {
		return this.search.searchWithRecent(query, topK, recentCount);
	}

	getRecent(limit: number): Result<Message[], DBError> {
		return this.db.getRecent(limit);
	}

	getAll(): Result<Message[], DBError> {
		return this.db.getAll();
	}

	count(): Result<number, DBError> {
		return this.db.count();
	}

	delete(id: number): Result<boolean, DBError> {
		return this.db.delete(id);
	}

	clear(): Result<number, DBError> {
		return this.db.clear();
	}

	close(): Result<void, DBError> {
		return this.db.close();
	}
}

export async function createVectorDB(dbPath?: string): Promise<VectorDB> {
	const db = new VectorDB(dbPath);
	await db.warmup();
	return db;
}
