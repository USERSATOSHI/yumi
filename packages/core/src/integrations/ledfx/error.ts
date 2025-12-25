import {ErrorBase } from '@yumi/results';

type Kinds = 'SceneNotFound' | 'ConnectionFailed' | 'ServerError';

export class LedFxError extends ErrorBase<Kinds> {
	static SceneNotFound(sceneId: string) {
		return new LedFxError(`Scene not found: ${sceneId}`, 'SceneNotFound');
	}

	static ConnectionFailed(message: string) {
		return new LedFxError(`Connection failed: ${message}`, 'ConnectionFailed');
	}

	static readonly ServerError = new LedFxError('Internal server error', 'ServerError');
}