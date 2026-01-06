import { Singleton } from '@yumi/patterns';
import { Result, safe } from '@yumi/results';
import { Ollama as OllamaPkg } from 'ollama';
import { ToolClassifierError } from './error.js';
import { model as logger } from '../../logger/index.js';
import { env } from 'bun';

const ollama = new OllamaPkg({
	host: env.OLLAMA_GPU_BASE_URL || 'http://localhost:11435',
});


export class ToolClassifier extends Singleton {
	#model = 'qwen3:0.6b';

	// 🔑 Single source of truth: intents + themes + descriptions
	static readonly INTENTS = {
		NO_TOOL: {
			theme: 'general',
			description: 'Pure conversation or informational request',
		},

		MEDIA_PLAY: {
			theme: 'media',
			description: 'Play or start media or music',
		},
		MEDIA_PAUSE: {
			theme: 'media',
			description: 'Pause media playback',
		},
		MEDIA_STOP: {
			theme: 'media',
			description: 'Stop media playback',
		},
		MEDIA_NEXT: {
			theme: 'media',
			description: 'Skip to the next media track',
		},
		MEDIA_PREVIOUS: {
			theme: 'media',
			description: 'Go to the previous media track',
		},
		MEDIA_VOLUME: {
			theme: 'media',
			description: 'Change the media volume',
		},

		TIME_GET: {
			theme: 'time',
			description: 'Get the current time or date',
		},

		REMINDER_ADD: {
			theme: 'reminder',
			description: 'Create a reminder',
		},
		REMINDER_LIST: {
			theme: 'reminder',
			description: 'List upcoming reminders',
		},
		REMINDER_DELETE: {
			theme: 'reminder',
			description: 'Delete a reminder',
		},

		TODO_ADD: {
			theme: 'todo',
			description: 'Create a to-do item',
		},
		TODO_LIST: {
			theme: 'todo',
			description: 'List to-do items',
		},
		TODO_COMPLETE: {
			theme: 'todo',
			description: 'Mark a to-do item as completed',
		},
		TODO_DELETE: {
			theme: 'todo',
			description: 'Delete a to-do item',
		},
		DEVICE_MUTE: {
			theme: 'device',
			description: 'Mute or unmute a device',
		},
		DEVICE_SHUTDOWN: {
			theme: 'device',
			description: 'Shut down a device',
		},
		DEVICE_SLEEP: {
			theme: 'device',
			description: 'Put a device to sleep',
		},
		DEVICE_LOCK: {
			theme: 'device',
			description: 'Lock a device',
		},
		ROUTINE_GOOD_NIGHT: {
			theme: 'routine',
			description:
				'User indicates they are going to sleep or says good night and wants bedtime actions executed',
		},
	} as const;

	// Derived type (no enum file needed)
	public static readonly INTENT_VALUES = Object.keys(ToolClassifier.INTENTS) as Array<
		keyof typeof ToolClassifier.INTENTS
	>;

	// 🧠 Prompt is generated from INTENTS (no duplication)
	#systemPrompt = (() => {
		const byTheme: Record<string, string[]> = {};

		for (const [intent, meta] of Object.entries(ToolClassifier.INTENTS)) {
			byTheme[meta.theme] ??= [];
			byTheme[meta.theme]!.push(`- ${intent}: ${meta.description}`);
		}

		const sections = Object.entries(byTheme)
			.map(([theme, lines]) => `### ${theme.toUpperCase()}\n${lines.join('\n')}`)
			.join('\n\n');

		return `
You are an INTENT classifier.

You must output EXACTLY ONE intent from the list below.
Never explain your answer.
Never output anything except the intent name.

${sections}

Rules:
- You must output exactly ONE intent name from the list.
- NEVER output wildcard values like ROUTINE_* or MEDIA_*.
- Choose the MOST SPECIFIC intent.
- Routine intents take precedence over conversational interpretations.
- If the user says "good night", "going to sleep", or similar, use ROUTINE_GOOD_NIGHT.
- Media playback commands must use the specific MEDIA_* intent listed.
- Time requests must use TIME_GET.
- Reminder management must use REMINDER_* intents.
- To-do management must use TODO_* intents.
- Volume changes must use MEDIA_VOLUME.
- Use NO_TOOL ONLY if the request is purely conversational and implies no action.


`;
	})();

	async classify(
		message: string,
	): Promise<
		Result<
			{ intent: keyof typeof ToolClassifier.INTENTS; needsTool: boolean },
			ToolClassifierError
		>
	> {
		const responseResult = await safe(
			ollama.chat({
				model: this.#model,
				stream: false,
				messages: [
					{ role: 'system', content: this.#systemPrompt },
					{ role: 'user', content: message },
				],
				options: {
					low_vram: true,
					temperature: 0.1,
				},
			}),
		);

		if (responseResult.isErr()) {
			return Result.err(
				ToolClassifierError.InvalidResponse(responseResult.unwrapErr()!.message),
			);
		}

		const intent = responseResult.unwrap()!.message.content.trim();

		logger.info(`ToolClassifier intent: ${intent}`);

		if (!ToolClassifier.INTENT_VALUES.includes(intent as keyof typeof ToolClassifier.INTENTS)) {
			return Result.err(ToolClassifierError.InvalidResponse(`Unknown intent: ${intent}`));
		}

		return Result.ok({
			intent: intent as keyof typeof ToolClassifier.INTENTS,
			needsTool: intent !== 'NO_TOOL',
		});
	}
}

export const toolClassifier = ToolClassifier.getInstance();
