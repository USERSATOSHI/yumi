import { Blob } from 'node:buffer';

import { voicevox as logger } from '../logger/index';
import { Singleton } from '@yumi/patterns';
import { Result, safe } from '@yumi/results';
import { VoiceVoxError } from './error';
import type { Speaker } from './type';

import { env } from 'bun';

export class VoiceVox extends Singleton {
	#api: string;
	constructor(api: string) {
		super();
		this.#api = api;
	}

	get api() {
		return this.#api;
	}

	async getAudioQuery(
		text: string,
		speaker: number,
		enableKatanaEnglish = true,
		coreVersion?: string
	) : Promise<Result<Record<string, unknown>, VoiceVoxError>> {
		const start = logger.time();

		const url = new URL(`${this.#api}/audio_query`);
		url.searchParams.append('text', text);
		url.searchParams.append('speaker', speaker.toString());
		if (enableKatanaEnglish) {
			url.searchParams.append('enable_katana_english', 'true');
		}
		if (coreVersion) {
			url.searchParams.append('core_version', coreVersion);
		}

		const responseResult = await safe(
			fetch(url.toString(), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
		);

		if (responseResult.isErr()) {
			logger.withMetrics({ duration: start() }).info(`Failed to get audio query: ${responseResult.unwrapErr()!.message}`);
			return Result.err(VoiceVoxError.NetworkError(responseResult.unwrapErr()!.message));
		}

		const response = responseResult.unwrap()!;

		if (!response.ok) {
			if (response.status === 400) {
				const errorText = await response.text();
				logger.withMetrics({ duration: start() }).info(`Failed to get audio query: ${errorText}`);
				return Result.err(VoiceVoxError.FailedAudioQuery(errorText));
			}

			logger.withMetrics({ duration: start() }).info(`VoiceVox server error when getting audio query`);
			return Result.err(VoiceVoxError.ServerError);
		}

		const audioQuery = await response.json() as Record<string, unknown>;
		logger.withMetrics({ duration: start() }).info(`Obtained audio query from VoiceVox`);
		return Result.ok(audioQuery);
	}

	async synthesis(
		query: Record<string, unknown>,
		speaker: number,
		enableInterrogativeUpspeak = true,
		coreVersion?: string	
	): Promise<Result<Blob, VoiceVoxError>> {
		const start = logger.time();
		const url = new URL(`${this.#api}/synthesis`);
		url.searchParams.append('speaker', speaker.toString());
		if (enableInterrogativeUpspeak) {
			url.searchParams.append('enable_interrogative_upspeak', 'true');
		}
		if (coreVersion) {
			url.searchParams.append('core_version', coreVersion);
		}

		const responseResult = await safe(
			fetch(url.toString(), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(query),
			})
		);

		if (responseResult.isErr()) {
			logger.withMetrics({ duration: start() }).info(`Failed to synthesize audio: ${responseResult.unwrapErr()!.message}`);
			return Result.err(VoiceVoxError.NetworkError(responseResult.unwrapErr()!.message));
		}

		const response = responseResult.unwrap()!;

		if (!response.ok) {
			logger.withMetrics({ duration: start() }).info(`VoiceVox server error during synthesis`);
			return Result.err(VoiceVoxError.SynthesisError(`Status code: ${response.status}`));
		}

		const audioBlob = await response.blob();
		logger.withMetrics({ duration: start() }).info(`Synthesized audio from VoiceVox`);
		return Result.ok(audioBlob);
	}

	async getSpeakers(): Promise<Result<Speaker[], VoiceVoxError>> {
		const start = logger.time();
		const responseResult = await safe(
			fetch(`${this.#api}/speakers`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})
		);

		if (responseResult.isErr()) {
			logger.withMetrics({ duration: start() }).info(`Failed to get speakers: ${responseResult.unwrapErr()!.message}`);
			return Result.err(VoiceVoxError.NetworkError(responseResult.unwrapErr()!.message));
		}

		const response = responseResult.unwrap()!;
		
		if (!response.ok) {
			logger.withMetrics({ duration: start() }).info(`VoiceVox server error when getting speakers`);
			return Result.err(VoiceVoxError.ServerError);
		}

		const speakers: Speaker[] = await response.json() as Speaker[];
		logger.withMetrics({ duration: start() }).info(`Obtained speakers from VoiceVox`);
		return Result.ok(speakers);
	}
}

const voicevox = new VoiceVox(env.VoiceVoxApi ?? 'http://localhost:50021');
export default voicevox;