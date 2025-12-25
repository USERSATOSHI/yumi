import path, { join } from 'node:path';

const dataDir = process.env.YUMI_DATA_DIR ?? join(process.cwd(), '.yumi');

export const CONFIG = {
	dbPath: join(dataDir, 'chat.sqlite'),
	embeddingModel: 'Xenova/all-MiniLM-L6-v2',
	embeddingPath: path.resolve(import.meta.dir, '../models/embeddings/all-MiniLM-L6-v2'),
	embeddingDimension: 384,
	maxContextTokens: 4000,
	topK: 10,
	similarityThreshold: 0.3,
} as const;

console.log(CONFIG);
