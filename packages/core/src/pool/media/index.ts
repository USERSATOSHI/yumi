import { Singleton } from "@yumi/patterns";

export type MediaState = {
	hash: string;
	title?: string;
	artist?: string;
	status: 'Playing' | 'Paused' | 'stopped';
	updatedAt: number;
};

/**
 * Tracks media playback state for each device.
 * Used to determine which devices are actively playing media.
 */
export class MediaStatePool extends Singleton {
	#states: Map<string, MediaState> = new Map();

	/** Timeout in ms to consider a device's state as stale (5 minutes) */
	static readonly STALE_TIMEOUT = 5 * 60 * 1000;

	/**
	 * Update or set the media state for a device
	 */
	update(hash: string, state: Omit<MediaState, 'hash' | 'updatedAt'>): void {
		this.#states.set(hash, {
			hash,
			...state,
			updatedAt: Date.now(),
		});
	}

	/**
	 * Get media state for a specific device
	 */
	get(hash: string): MediaState | undefined {
		const state = this.#states.get(hash);
		if (!state) return undefined;

		// Check if state is stale
		if (Date.now() - state.updatedAt > MediaStatePool.STALE_TIMEOUT) {
			this.#states.delete(hash);
			return undefined;
		}

		return state;
	}

	/**
	 * Remove media state for a device (e.g., when device disconnects)
	 */
	remove(hash: string): void {
		this.#states.delete(hash);
	}

	/**
	 * Get all devices that are currently playing media
	 */
	getPlayingDevices(): MediaState[] {
		const now = Date.now();
		const playing: MediaState[] = [];

		for (const [hash, state] of this.#states) {
			if ((now - state.updatedAt) > MediaStatePool.STALE_TIMEOUT) {
				this.#states.delete(hash);
				continue;
			}

			if (state.status !== 'stopped') {
				playing.push(state);
			}
		}

		return playing;
	}

	/**
	 * Get all tracked media states (excluding stale)
	 */
	list(): MediaState[] {
		const now = Date.now();
		const states: MediaState[] = [];

		for (const [hash, state] of this.#states) {
			if (now - state.updatedAt > MediaStatePool.STALE_TIMEOUT) {
				this.#states.delete(hash);
				continue;
			}
			states.push(state);
		}

		return states;
	}

	/**
	 * Check if a specific device is currently playing
	 */
	isPlaying(hash: string): boolean {
		const state = this.get(hash);
		return state?.status === 'Playing';
	}

	clear(): void {
		this.#states.clear();
	}
}

export const mediaStatePool = MediaStatePool.getInstance();
