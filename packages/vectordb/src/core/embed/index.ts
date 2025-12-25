import { env, pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import { Result } from '@yumi/results';
import { CONFIG } from '../../config';
import { DBError } from '../../errors';

env.allowRemoteModels = false;
env.localModelPath = CONFIG.embeddingPath;

type EmbedderState =
	| { status: 'idle' }
	| { status: 'loading'; promise: Promise<FeatureExtractionPipeline> }
	| { status: 'ready'; pipeline: FeatureExtractionPipeline };

export class Embedder {
	private state: EmbedderState = { status: 'idle' };

	private async getPipeline(): Promise<FeatureExtractionPipeline> {
		if (this.state.status === 'ready') return this.state.pipeline;

		if (this.state.status === 'loading') return this.state.promise;

		const promise = pipeline('feature-extraction', CONFIG.embeddingModel, {
			quantized: true,
		});

		this.state = { status: 'loading', promise };

		const loadedPipeline = await promise;
		this.state = { status: 'ready', pipeline: loadedPipeline };

		return loadedPipeline;
	}

	async embed(text: string): Promise<Result<Float32Array, DBError>> {
		try {
			const extractor = await this.getPipeline();
			const output = await extractor(text, { pooling: 'mean', normalize: true });
			const embedding = output.data as Float32Array;

			if (embedding.length !== CONFIG.embeddingDimension) {
				return Result.err(DBError.DimensionMismatch(CONFIG.embeddingDimension, embedding.length));
			}

			return Result.ok(embedding);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return Result.err(DBError.EmbeddingFailed(message));
		}
	}

	async embedBatch(texts: string[]): Promise<Result<Float32Array[], DBError>> {
		try {
			const extractor = await this.getPipeline();
			const embeddings: Float32Array[] = [];

			for (const text of texts) {
				const output = await extractor(text, { pooling: 'mean', normalize: true });
				embeddings.push(output.data as Float32Array);
			}

			return Result.ok(embeddings);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return Result.err(DBError.EmbeddingFailed(message));
		}
	}

	async warmup(): Promise<Result<void, DBError>> {
		try {
			await this.getPipeline();
			return Result.ok(undefined);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return Result.err(DBError.EmbeddingFailed(message));
		}
	}

	isReady(): boolean {
		return this.state.status === 'ready';
	}
}