import { jsonrepair } from 'jsonrepair';

import { model as logger, model } from '../../logger/index';
import { Singleton } from '@yumi/patterns';
import { env } from 'bun';
import type { Message } from '../types';
import { Result, safe } from '@yumi/results';
import { ToolCallError } from './error';
import ollama from 'ollama';
import { toolsForAI, getToolsForIntent } from 'packages/core/src/tools';
import { type ToolCall as ToolCallType } from 'ollama';
import type { ToolClassifier } from '../tool-classifier/index.js';

export class ToolCall extends Singleton {
		#model = env.toolcall_model || 'functiongemma';
	#systemPrompt = `
You are a tool-calling assistant.

Your job is to call the correct tool when needed.

RULES:
- Call the tool from the provided tool list that best matches the user's request
- Only call tools that are in the provided tool list
- If no tool is required, return NOTHING
- Do NOT respond with text
- Do NOT explain your reasoning
- Do NOT ask questions
- NEVER invent arguments

IMPORTANT:
- For device/media tools, do NOT provide hash/deviceHash - it will be auto-filled
`;

	async generate(
		message: string,
		shouldCallTool: { intent: keyof typeof ToolClassifier.INTENTS; needsTool: boolean },
	): Promise<Result<ToolCallType[] | undefined, ToolCallError>> {
		const end = logger.time();

		// Filter tools based on intent - model only sees relevant tools
		const filteredTools = getToolsForIntent(shouldCallTool.intent);
		
		logger.debug(`Intent: ${shouldCallTool.intent} → Tools: [${filteredTools.map(t => t.function.name).join(', ')}]`);

		const messages = [
			{ role: 'system', content: this.#systemPrompt },
			{ role: 'user', content: message },
		];

		const responseResult = await safe(
			ollama.chat({
				model: this.#model,
				messages,
				stream: false,
				tools: filteredTools,
				think: false,
				options: {
					low_vram: true,
					num_ctx: 1024,
					num_predict: 128,
					temperature: 0,
				},
			}),
		);

		if (responseResult.isErr()) {
			logger.error(
				`Ollama generateResponse error: ${responseResult.unwrapErr()!.message}`,
				{ duration: end() },
			);
			return Result.err(
				ToolCallError.InvalidResponse(
					responseResult.unwrapErr()!.message,
				),
			);
		}

		const response = responseResult.unwrap()!;
		model.withMetrics({duration: end()}).info(`ToolCall response: ${response.message.tool_calls ? JSON.stringify(response.message.tool_calls, null, 2) : 'no tool calls'}`);

		return Result.ok(response.message.tool_calls);
	}
}

export const toolCall = ToolCall.getInstance();
