import { status } from 'elysia';
import { join } from 'path';
import { env } from 'bun';

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
import { broadcastSpeak } from '../ws/broadcast.js';
import type { Reminder } from '../../pool/reminders/index.js';

const DEFAULT_AUDIO_PATH = process.env.YUMI_AUDIO_PATH ?? join(process.cwd(), '.yumi', 'audio.wav');
const DEFAULT_REMINDER_AUDIO_PATH = process.env.YUMI_REMINDER_AUDIO_PATH ?? join(process.cwd(), '.yumi', 'reminder-audio.wav');
const DEFAULT_SPEAKER = 46;
const SERVER_URL = env.YUMI_SERVER_URL ?? 'yumi.home.usersatoshi.in';

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

	/**
	 * Generate speech for a reminder and broadcast to all deck clients.
	 * Simpler version of generate() that doesn't require a Request object.
	 */
	static async speakReminder(reminder: Reminder): Promise<boolean> {
		const end = request.time();
		
		try {
			// Generate a natural reminder message
			const promptText = `You have a reminder: "${reminder.title}"${reminder.description ? `. ${reminder.description}` : ''}`;
			
			// Use Ollama to generate a natural response
			const ollamaResult = await ollama.generate(promptText, [
				{
					role: 'system',
					content: 'You are announcing a reminder to the user. Be brief, friendly, and helpful. Keep your response under 2 sentences.',
				}
			]);

			let enText: string;
			let jpText: string;

			if (ollamaResult.isErr()) {
				// Fallback to simple reminder text if Ollama fails
				request.warn(`Ollama failed for reminder speech, using fallback: ${ollamaResult.unwrapErr()!.message}`);
				enText = `Hey! Just a reminder: ${reminder.title}`;
				jpText = `リマインダーです。${reminder.title}`;
			} else {
				const res = ollamaResult.unwrap()!;
				enText = res.en;
				jpText = res.jp;
			}

			// Generate audio using the existing private method
			const audioBuffer = await this.#createAudio(jpText, DEFAULT_SPEAKER, 'reminder');
			
			// Save to reminder audio path
			await Bun.write(DEFAULT_REMINDER_AUDIO_PATH, audioBuffer);

			// Broadcast to all decks
			const success = broadcastSpeak({
				en: enText,
				jp: jpText,
				audio: `http://${SERVER_URL}/api/speak/reminder-audio`,
				reason: 'reminder',
			});

			request.withMetrics({ duration: end() }).info(`Reminder speech generated and broadcasted: ${reminder.title}`);
			return success;
		} catch (error) {
			request.withMetrics({ duration: end() }).error(`Failed to generate reminder speech: ${(error as Error).message}`);
			return false;
		}
	}
}
