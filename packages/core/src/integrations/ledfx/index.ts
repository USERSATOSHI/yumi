import { Singleton } from '@yumi/patterns';
import { Result, safe } from '@yumi/results';
import { ledfx as ledfxLogger } from '../logger';

import { LedFxError } from './error';
import { env } from 'bun';

export enum LedFxScene {
	Cozy = 'cozy',
	Work = 'work',
	Sleep = 'sleep',
	Party = 'party',
}

export class LedFx extends Singleton {

	async switch(deviceHash: string, scene: LedFxScene): Promise<Result<void, LedFxError>> {
		const end = ledfxLogger.time();

		const api = // get api based on device hash
			`http://${deviceHash}.local:8888`;

		const res = await safe(
			fetch(`${api}/api/scenes`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: scene, action: 'activate' })
			})
		)

		if (res.isErr()) {
			ledfxLogger.withMetrics({ duration: end() }).info(`Failed to switch LEDfx scene: ${scene}`);
			return Result.err(LedFxError.ConnectionFailed(res.unwrapErr()!.message));
		}

		const response = res.unwrap()!;

		if (!response.ok) {
			if (response.status === 404) {
				ledfxLogger.withMetrics({ duration: end() }).info(`LEDfx scene not found: ${scene}`);
				return Result.err(LedFxError.SceneNotFound(scene));
			} else {
				ledfxLogger.withMetrics({ duration: end() }).info(`LEDfx server error when switching to scene: ${scene}`);
				return Result.err(LedFxError.ServerError);
			}
		}

		ledfxLogger.withMetrics({ duration: end() }).info(`Switched to LEDfx scene: ${scene}`);
		return Result.ok(undefined);
	}
}

const ledfx = LedFx.getInstance();
export default ledfx;