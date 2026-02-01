import { Singleton } from '@yumi/patterns';
import { Result, safe } from '@yumi/results';
import { Ollama as OllamaPkg } from 'ollama';
import { ToolClassifierError } from './error.js';
import { model as logger } from '../../logger/index.js';
import { env } from 'bun';

const ollama = new OllamaPkg({
	host: env.OLLAMA_CPU_BASE_URL || 'http://localhost:11434',
});


export class ToolClassifier extends Singleton {
	#model = 'qwen2:0.5b';

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

	/**
	 * Normalize the raw model output to find the best matching intent.
	 * Handles typos like "REMIND_ADD" -> "REMINDER_ADD" and extra words like "REMINDER_ADD Intent".
	 */
	#normalizeIntent(raw: string): keyof typeof ToolClassifier.INTENTS | null {
		// Clean up: uppercase, remove extra words, trim
		let cleaned = raw.toUpperCase().trim();
		
		// Remove common suffixes the model might add
		cleaned = cleaned.replace(/\s*(INTENT|ACTION|COMMAND|TOOL)$/i, '').trim();
		
		// Direct match first
		if (ToolClassifier.INTENT_VALUES.includes(cleaned as keyof typeof ToolClassifier.INTENTS)) {
			return cleaned as keyof typeof ToolClassifier.INTENTS;
		}

		// Fuzzy match: find the closest intent
		let bestMatch: keyof typeof ToolClassifier.INTENTS | null = null;
		let bestScore = 0;

		for (const validIntent of ToolClassifier.INTENT_VALUES) {
			const score = this.#similarity(cleaned, validIntent);
			if (score > bestScore && score >= 0.7) { // 70% similarity threshold
				bestScore = score;
				bestMatch = validIntent;
			}
		}

		if (bestMatch) {
			logger.info(`ToolClassifier fuzzy matched "${raw}" -> "${bestMatch}" (score: ${bestScore.toFixed(2)})`);
		}

		return bestMatch;
	}

	/**
	 * Calculate similarity between two strings (0-1).
	 * Uses a simple character-level comparison.
	 */
	#similarity(a: string, b: string): number {
		if (a === b) return 1;
		if (!a.length || !b.length) return 0;

		// Check if one contains the other (partial match bonus)
		if (a.includes(b) || b.includes(a)) {
			return Math.min(a.length, b.length) / Math.max(a.length, b.length);
		}

		// Levenshtein distance-based similarity
		const matrix: number[][] = [];
		for (let i = 0; i <= a.length; i++) {
			matrix[i] = [i];
		}
		for (let j = 0; j <= b.length; j++) {
			matrix[0]![j] = j;
		}
		for (let i = 1; i <= a.length; i++) {
			for (let j = 1; j <= b.length; j++) {
				const cost = a[i - 1] === b[j - 1] ? 0 : 1;
				matrix[i]![j] = Math.min(
					matrix[i - 1]![j]! + 1,
					matrix[i]![j - 1]! + 1,
					matrix[i - 1]![j - 1]! + cost,
				);
			}
		}
		const distance = matrix[a.length]![b.length]!;
		return 1 - distance / Math.max(a.length, b.length);
	}

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
			}),
		);

		if (responseResult.isErr()) {
			return Result.err(
				ToolClassifierError.InvalidResponse(responseResult.unwrapErr()!.message),
			);
		}

		const rawIntent = responseResult.unwrap()!.message.content.trim();
		logger.info(`ToolClassifier raw output: "${rawIntent}"`);

		const intent = this.#normalizeIntent(rawIntent);

		if (!intent) {
			logger.warn(`ToolClassifier could not match intent: "${rawIntent}"`);
			return Result.err(ToolClassifierError.InvalidResponse(`Unknown intent: ${rawIntent}`));
		}

		logger.info(`ToolClassifier resolved intent: ${intent}`);

		return Result.ok({
			intent,
			needsTool: intent !== 'NO_TOOL',
		});
	}
}

export const toolClassifier = ToolClassifier.getInstance();
