import { jsonrepair } from 'jsonrepair';

import { model as logger } from '../../logger/index';
import { Singleton } from '@yumi/patterns';
import { env } from 'bun';
import type { Message, Text } from '../types';
import { Result, safe } from '@yumi/results';
import { OllamaError } from './error.js';
import { Ollama as OllamaPkg } from 'ollama';

const oll = new OllamaPkg({
	host: env.OLLAMA_GPU_BASE_URL || 'http://localhost:11435',
});


export class Ollama extends Singleton {
	#model = env.ollama_model || 'gemma3:4b';
	#systemPrompt = `
You are Yumi, a friendly assistant. You are friendly, knowledgeable, and efficient.

JSON Response Format:
{ "en": string, "jp": string }

CRITICAL RULES:
1) TOOL_RESULTS is REAL-TIME data. Use it to answer factual questions (time, date, weather, etc.)
2) When answering questions about "today", "now", "current" - USE the date/time from TOOL_RESULTS
3) Apply your knowledge to interpret tool results (e.g., if date is 12/25, you know that's Christmas)
4) Output ONLY the JSON object. No markdown, no commentary, no extra text.
5) "jp": concise Japanese response, "en": English translation
6) Do NOT ask questions or request clarification.
7) IGNORE conversation history if it conflicts with TOOL_RESULTS.
`;

	async generate(
		message: string,
		context?: Omit<Message, 'embedding' | 'createdAt'>[],
	): Promise<Result<Text, OllamaError>> {
		const end = logger.time();
		const messages = [{ role: 'system', content: this.#systemPrompt }];

		if (context && context.length > 0) {
			messages.push(...context);
		}

		messages.push({ role: 'user', content: message });

		const responseResult = await safe(
			oll.chat({
				model: this.#model,
				messages,
				stream: false,
				options: {
					low_vram: true,
					num_ctx: 1024,
					num_predict: 128,
					temperature: 0.3,
				},
			}),
		);

		if (responseResult.isErr()) {
			logger.error(
				`Ollama generateResponse error: ${responseResult.unwrapErr()!.message}`,
				{ duration: end() },
			);
			return Result.err(
				OllamaError.InvalidResponse(responseResult.unwrapErr()!.message),
			);
		}

		const response = responseResult.unwrap()!;

		try {
			const repaired = jsonrepair(response.message.content);
			const parsed: Text = JSON.parse(repaired);

			logger.info(`Ollama generateResponse success`, {
				duration: end(),
			});

			return Result.ok(parsed);
		} catch (e) {
			logger.error(
				`Ollama generateResponse JSON parse error: ${(e as Error).message}`,
				{ duration: end() },
			);
			return Result.err(
				OllamaError.InvalidResponse((e as Error).message),
			);
		}
	}
}

export const ollama = Ollama.getInstance();
