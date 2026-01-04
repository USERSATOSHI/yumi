import { jsonrepair } from 'jsonrepair';

import { model as logger } from '../../logger/index';
import { Singleton } from '@yumi/patterns';
import { env } from 'bun';
import type { Message } from '../types';
import { Result, safe } from '@yumi/results';
import { ToolCallError } from './error';
import ollama from 'ollama';
import { tools } from 'packages/core/src/tools';
import type { Device } from 'packages/core/src/pool/devices/index.js';
import { type ToolCall as ToolCallType } from 'ollama';

export class ToolCall extends Singleton {
	#model = env.toolcall_model || 'qwen3:4b-instruct-2507-q4_K_M';

	#systemPrompt = `
You are a tool-calling assistant. Your job is to determine if the user's request needs a tool call and execute it.

Rules:
- If the request needs real-time or external data, call the appropriate tool
- If the request can be answered with general knowledge alone, do not call any tool
- Respond only with: true (tool called) or false (no tool called)

IMPORTANT:
- ANY question about current time, date, day, or comparing dates (e.g., "is today X") → call getCurrentTime
- Questions about personal data (calendar, events, birthdays) → call relevant tool if available
- If unsure whether you need real data, call the tool anyway
- When calling media/device tools (playMedia, pauseMedia, stopMedia, setMediaVolume, etc.), you MUST use the actual device hash from the connected devices list - NEVER use placeholder values like "music_device_hash"
- If only one device is connected, use that device's hash for any device-related request
`;

	async generate(
		message: string,
		devices?: Device[],
	): Promise<Result<ToolCallType[] | undefined, ToolCallError>> {
		const end = logger.time();
		const messages = [
			{ role: 'system', content: this.#systemPrompt },
			devices
				? this.#getDevicesMessage(devices)
				: { role: 'system', content: 'no devices connected' },
			{ role: 'user', content: message },
		];

		console.log('ToolCall#generate messages:', messages);

		const responseResult = await safe(
			ollama.chat({
				model: this.#model,
				messages,
				stream: false,
				tools,
				think: false,
				options: {
					low_vram: true,
				},
			}),
		);

		if (responseResult.isErr()) {
			logger.error(`Ollama generateResponse error: ${responseResult.unwrapErr()!.message}`, {
				duration: end(),
			});
			return Result.err(ToolCallError.InvalidResponse(responseResult.unwrapErr()!.message));
		}

		const response = responseResult.unwrap()!;

		return Result.ok(response.message.tool_calls);
	}

	#getDevicesMessage(devices: Device[]): Message {
		if (devices.length === 0) {
			return {
				role: 'system',
				content: 'No devices are currently connected. Cannot execute device/media commands.',
			};
		}

		const deviceList = devices
			.map((device) => `- Name: "${device.name}" → hash: "${device.hash}"`)
			.join('\n');

		return {
			role: 'system',
			content: `Connected devices (USE THESE EXACT HASHES for tool calls):\n${deviceList}`,
		};
	}
}

export const toolCall = ToolCall.getInstance();