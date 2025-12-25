import { Singleton } from '@yumi/patterns';
import { Result, safe } from '@yumi/results';
import { ha as logger } from '../logger';

import { HAError } from './error';
import { env } from 'bun';

export class HA extends Singleton {
	#token: string = env.HA_TOKEN || '';

	constructor() {
		super();
		if (!this.#token) {
			logger.warn('Home Assistant token is not set. Please set HA_TOKEN in environment variables.');
		}
	}

	async call(service: string, data: Record<string, any>): Promise<Result<void, HAError>> {
		const end = logger.time();

		const responseResult = await safe(
			fetch(`http://localhost:8123/api/services/${service}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.#token}`
				},
				body: JSON.stringify(data)
			})
		);

		if (responseResult.isErr()) {
			logger.withMetrics({ duration: end() }).info(`Failed to call Home Assistant service: ${service}`);
			return Result.err(HAError.CallFailed(responseResult.unwrapErr()!.message));
		}

		const response = responseResult.unwrap()!;

		if (!response.ok) {
			if (response.status === 401) {
				logger.withMetrics({ duration: end() }).info(`Invalid Home Assistant token when calling service: ${service}`);
				return Result.err(HAError.InvalidHAToken);
			} else if (response.status === 404) {
				logger.withMetrics({ duration: end() }).info(`Home Assistant integration not found for service: ${service}`);
				return Result.err(HAError.IntegrationNotFound(service));
			} else {
				logger.withMetrics({ duration: end() }).info(`Home Assistant call failed for service: ${service}`);
				return Result.err(HAError.CallFailed(`Status code: ${response.status}`));
			}
		}

		logger.withMetrics({ duration: end() }).info(`Successfully called Home Assistant service: ${service}`);
		return Result.ok(undefined);
	}
}

const ha = HA.getInstance();
export default ha;