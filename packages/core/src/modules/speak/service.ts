import { status } from 'elysia';
import { join } from 'path';

import { createVectorDB, type Message, type VectorDB } from '@yumi/vectordb';

import type { SpeakModel } from './model';
import { query, request } from '../../integrations/logger';
import { toolCall } from '../../integrations/models/tool-call';
import { devicePool } from '../../pool/devices/index.js';
import { executeCommand } from '../../command/handler.js';
import { safe } from '@yumi/results';
import { ollama } from '../../integrations/models/ollama/index.js';
import voicevox from '../../integrations/voicevox/index.js';
import { serverHolder } from '../../server.js';

const DEFAULT_AUDIO_PATH = process.env.YUMI_AUDIO_PATH ?? join(process.cwd(), '.yumi', 'audio.wav');

export abstract class Speak {
	static #vectordb: VectorDB | null = null;

	static async #getVectorDB(): Promise<VectorDB> {
		if (!this.#vectordb) {
			this.#vectordb = await createVectorDB();
		}
		return this.#vectordb;
	}

	static async generate(
		{ text, speaker, identifier }: SpeakModel.Body & { identifier: string },
		req: Request,
	): Promise<SpeakModel.ResponseOk | SpeakModel.ResponseError> {
		const end = request.time();
		if (!text || text.trim() === '') {
			throw status(400, { error: 'Text cannot be empty' });
		}

		if (typeof speaker !== 'number' || isNaN(speaker)) {
			throw status(400, { error: 'Speaker must be a valid number' });
		}

		if (!identifier || identifier.trim() === '') {
			throw status(400, { error: 'Identifier cannot be empty' });
		}

		const serverURL = req.headers.get('host') || 'yumi.home.usersatoshi.in';

		// Fetch context and tool calls in parallel
		const [contexts, tools] = await Promise.all([this.#getContext(text), this.toolCall(text)]);

		const filteredContexts: Omit<Message, 'embedding' | 'createdAt'>[] = contexts.map(
			({ id, role, content }) => ({
				id,
				role,
				content,
			}),
		);

		const toolResults = await this.#executeToolCalls(tools);

		// Build context with old context first, then tool results LAST (closest to user message = highest priority)
		const finalContext: Omit<Message, 'embedding' | 'createdAt'>[] = [];

		// Add old context first (lower priority - further from user message)
		finalContext.push(...filteredContexts);

		// Add tool results LAST, right before user message (highest priority)
		if (toolResults && Object.keys(toolResults).length > 0) {
			finalContext.push({
				role: 'system' as const,
				content: `TOOL_RESULTS (CURRENT/REAL-TIME DATA - this is accurate, ignore conflicting history):\n${Object.entries(toolResults).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}`,
				id: -1,
			});
		}

		// Call Ollama to generate the speech synthesis response
		const ollamaResult = await ollama.generate(text, finalContext);
		if (ollamaResult.isErr()) {
			request.error(`Ollama generate error: ${ollamaResult.unwrapErr()!.message}`);
			throw status(500, { error: 'Failed to generate speech synthesis response' });
		}

		const res = ollamaResult.unwrap()!;

		request.info(`Generated speech synthesis response successfully`);

		// Generate Audio using Voicevox
		const audio = await this.#createAudio(res.jp, speaker, identifier);
		await Bun.write(DEFAULT_AUDIO_PATH, audio);

		request.withMetrics({ duration: end() }).info(`Generated audio successfully`);

		return {
			en: res.en,
			jp: res.jp,
			audio: `http://${serverURL}/api/speak/audio`,
		};
	}

	static async #getContext(query: string) {
		const end = request.time();

		const vectordb = await this.#getVectorDB();

		const contexts = (await vectordb.getContext(query, 10)).unwrapOr([]);

		request.withMetrics({ duration: end() }).info(`Fetched context for speech synthesis`);
		return contexts;
	}

	static async toolCall(query: string) {
		const end = request.time();
		const devices = devicePool.links;

		const responseResult = await toolCall.generate(query, devices);
		if (responseResult.isErr()) {
			request.withMetrics({ duration: end() }).error(`Tool call failed: ${responseResult.unwrapErr()!.message}`);
			return null;
		}

		const res = responseResult.map(x => x ?? []).unwrapOr([])!.map((call) => call.function);
		request.withMetrics({ duration: end() }).info(`Fetched tool calls for speech synthesis`);

		return res;
	}

	static async #executeToolCalls(toolCalls: Awaited<ReturnType<typeof Speak.toolCall>>) {
		if (!toolCalls) {
			return;
		}

		const end = request.time();
		const results: Record<string, any> = {};

		for (const call of toolCalls) {
			const { success, result } = await executeCommand(call.name, call.arguments || {}, 'server', serverHolder.get() as any);
			if (!success) {
				request.warn(`Tool ${call.name} execution failed`);
			}
			results[call.name] = result;
		}

		request.withMetrics({ duration: end() }).info(`Executed tool calls for speech synthesis: ${JSON.stringify(results, null, 2)}`);
		return results;
	}

	static async #createAudio(text: string, speaker: number, identifier: string) {
		if (!text || text.trim() === '') {
			request;
			throw status(400, { error: 'Text cannot be empty' });
		}

		const audioQueryResult = await voicevox.getAudioQuery(text, speaker);

		if (audioQueryResult.isErr()) {
			request.error(`Voicevox getAudioQuery error: ${audioQueryResult.unwrapErr()!.message}`);
			throw status(500, { error: 'Failed to create audio query' });
		}

		const audioQuery = audioQueryResult.unwrap()!;

		const synthesisResult = await voicevox.synthesis(audioQuery, speaker);

		if (synthesisResult.isErr()) {
			request.error(`Voicevox synthesis error: ${synthesisResult.unwrapErr()!.message}`);
			throw status(500, { error: 'Failed to synthesize audio' });
		}

		const audioBuffer = synthesisResult.unwrap()!;

		request.info(`Generated audio successfully for identifier: ${identifier}`);
		return audioBuffer;
	}
}
