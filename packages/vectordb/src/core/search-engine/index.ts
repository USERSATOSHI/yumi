import { Result } from '@yumi/results';
import { CONFIG } from '../../config';
import { DBError } from '../../errors';
import { type Message, ChatDB } from '../database';
import { Embedder } from '../embed';

export interface SearchResult {
	message: Message;
	similarity: number;
}

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	let dot = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i]! * b[i]!;
	}
	return dot;
}

export class SearchEngine {
	constructor(
		private db: ChatDB,
		private embedder: Embedder,
	) {}

	async search(query: string, topK: number = CONFIG.topK): Promise<Result<SearchResult[], DBError>> {
		const embeddingResult = await this.embedder.embed(query);

		if (embeddingResult.isErr()) {
			return Result.err(embeddingResult.unwrapErr()!);
		}

		const queryEmbedding = embeddingResult.unwrap()!;

		const messagesResult = this.db.getAllWithEmbeddings();

		if (messagesResult.isErr()) {
			return Result.err(messagesResult.unwrapErr()!);
		}

		const messages = messagesResult.unwrap()!;

		const scored: SearchResult[] = messages.map((message) => ({
			message,
			similarity: cosineSimilarity(queryEmbedding, message.embedding),
		}));

		scored.sort((a, b) => b.similarity - a.similarity);

		const filtered = scored
			.filter((r) => r.similarity >= CONFIG.similarityThreshold)
			.slice(0, topK);

		return Result.ok(filtered);
	}

	async searchWithRecent(
		query: string,
		topK: number = CONFIG.topK,
		recentCount: number = 3,
	): Promise<Result<Message[], DBError>> {
		const recentResult = this.db.getRecent(recentCount);

		if (recentResult.isErr()) {
			return Result.err(recentResult.unwrapErr()!);
		}

		const recentMessages = recentResult.unwrap()!;
		const recentIds = new Set(recentMessages.map((m) => m.id));

		const searchResult = await this.search(query, topK);

		if (searchResult.isErr()) {
			return Result.err(searchResult.unwrapErr()!);
		}

		const similarMessages = searchResult
			.unwrap()!
			.filter((r) => !recentIds.has(r.message.id))
			.map((r) => r.message);

		const combined = [...recentMessages, ...similarMessages];

		combined.sort((a, b) => a.createdAt - b.createdAt);

		return Result.ok(combined);
	}
}
