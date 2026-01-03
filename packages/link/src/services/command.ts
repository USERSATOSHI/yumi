/**
 * External Dependencies
 */
import { $, env } from 'bun';

/**
 * Yumi Internal Packages
 */
import { Singleton } from '@yumi/patterns';
import { Result } from '@yumi/results';

/**
 * Local Module Imports
 */
import { deviceControl, mediaControlLib } from '../ffi';
import { CommandError } from './command.error';

export interface TrackInfo {
	title: string;
	artist: string;
	duration: number;
	position: number;
	playback_status: 'playing' | 'paused' | 'stopped';
	artwork?: string;
}

export class CommandService extends Singleton {
	protected constructor() {
		super();
	}

	/**
	 * Execute a control command from WebSocket
	 * @param fn - The function/command name
	 * @param args - Command arguments
	 * @returns Result indicating success or error
	 */
	public async execute(
		fn: string,
		args?: Record<string, unknown>,
	): Promise<Result<unknown, CommandError>> {
		// Media control commands
		if (fn === 'playMedia') {
			return this.playMedia();
		}
		if (fn === 'pauseMedia') {
			return this.pauseMedia();
		}
		if (fn === 'nextTrack') {
			return this.nextTrack();
		}
		if (fn === 'previousTrack') {
			return this.prevTrack();
		}
		if (fn === 'seekTo') {
			const position = args?.position as string;
			if (!position) return Result.err(CommandError.InvalidCommand('seekTo requires position'));
			return this.seekTo(position);
		}
		if (fn === 'getCurrentTrackInfo') {
			return this.getCurrentTrack();
		}
		if (fn === 'searchPlayYoutube') {
			const query = args?.query as string;
			if (!query) return Result.err(CommandError.InvalidCommand('searchPlayYoutube requires query'));
			return this.searchPlayYoutube(query);
		}

		// Device control commands
		if (fn === 'volume') {
			const volume = args?.level as number;
			if (typeof volume !== 'number') {
				return Result.err(CommandError.InvalidCommand('setVolume requires volume number'));
			}
			return this.setVolume(volume*100);
		}
		if (fn === 'brightness') {
			const brightness = args?.level as number;
			if (typeof brightness !== 'number') {
				return Result.err(CommandError.InvalidCommand('setBrightness requires brightness number'));
			}
			return this.setBrightness(brightness);
		}
		if (fn === 'mute') {
			const enabled = args?.enabled !== false; // default true
			return this.mute(enabled);
		}
		if (fn === 'lock') {
			return this.lock();
		}
		if (fn === 'sleep') {
			return this.sleep();
		}
		if (fn === 'shutdown') {
			return this.shutdown();
		}
		if (fn === 'restart') {
			return this.restart();
		}
		if (fn === 'getDeviceState') {
			return this.getDeviceState();
		}

		return Result.err(CommandError.InvalidCommand(fn));
	}

	// ─── Media Control ───────────────────────────────────────────────────────

	private playMedia(): Result<boolean, CommandError> {
		try {
			mediaControlLib.symbols.playMedia();
			return Result.ok(true);
		} catch (error) {
			return Result.err(CommandError.CommandExecutionFailed('playMedia'));
		}
	}

	private pauseMedia(): Result<boolean, CommandError> {
		try {
			mediaControlLib.symbols.pauseMedia();
			return Result.ok(true);
		} catch (error) {
			return Result.err(CommandError.CommandExecutionFailed('pauseMedia'));
		}
	}

	private nextTrack(): Result<boolean, CommandError> {
		try {
			mediaControlLib.symbols.nextTrack();
			return Result.ok(true);
		} catch (error) {
			return Result.err(CommandError.CommandExecutionFailed('nextTrack'));
		}
	}

	private prevTrack(): Result<boolean, CommandError> {
		try {
			mediaControlLib.symbols.previousTrack();
			return Result.ok(true);
		} catch (error) {
			return Result.err(CommandError.CommandExecutionFailed('prevTrack'));
		}
	}

	private seekTo(position: string): Result<boolean, CommandError> {
		try {
			const positionStr = position + '\0';
			mediaControlLib.symbols.seekTo(Buffer.from(positionStr, 'utf-8'));
			return Result.ok(true);
		} catch (error) {
			return Result.err(CommandError.CommandExecutionFailed('seekTo'));
		}
	}

	public getCurrentTrack(): Result<TrackInfo, CommandError> {
		try {
			const json = mediaControlLib.symbols.getCurrentTrackInfo();

			try {
				const trackInfo = JSON.parse(json as unknown as string);
				const result: TrackInfo = {
					title: trackInfo.title || '',
					artist: trackInfo.artist || '',
					duration: trackInfo.duration || 0,
					position: trackInfo.current_position || 0,
					playback_status: trackInfo.playback_status || 'stopped',
					artwork: trackInfo.artwork || undefined,
				};

				return Result.ok(result);
			} catch {
				// Return default track info if parsing fails
				const defaultTrackInfo: TrackInfo = {
					title: '',
					artist: '',
					duration: 0,
					position: 0,
					playback_status: 'stopped',
				};

				return Result.ok(defaultTrackInfo);
			}
		} catch (error) {
			return Result.err(
				CommandError.FFIError(
					error instanceof Error ? error.message : 'Failed to get current track info',
				),
			);
		}
	}

	private async searchPlayYoutube(query: string): Promise<Result<boolean, CommandError>> {
		return await this.sendNativeMessage({
			action: 'playSong',
			song: query,
		});
	}

	// ─── Device Control ──────────────────────────────────────────────────────

	public getDeviceState(): Result<{ volume: number; brightness: number }, CommandError> {
		try {
			const volume = Math.round(deviceControl.symbols.getVolume() * 100);
			const brightness = deviceControl.symbols.getBrightness();
			return Result.ok({ volume, brightness });
		} catch (error) {
			return Result.err(CommandError.CommandExecutionFailed('getDeviceState'));
		}
	}

	private setVolume(volume: number): Result<boolean, CommandError> {
		try {
			if (isNaN(volume) || volume < 0 || volume > 100) {
				return Result.err(
					CommandError.InvalidCommand('Invalid volume value. Must be between 0 and 100.'),
				);
			}
			const normalizedVolume = volume / 100;
			deviceControl.symbols.volume(normalizedVolume);
			return Result.ok(true);
		} catch (error) {
			return Result.err(CommandError.CommandExecutionFailed('setVolume'));
		}
	}

	private setBrightness(brightness: number): Result<boolean, CommandError> {
		try {
			if (isNaN(brightness) || brightness < 0 || brightness > 100) {
				return Result.err(
					CommandError.InvalidCommand('Invalid brightness value. Must be between 0 and 100.'),
				);
			}
			deviceControl.symbols.brightness(brightness);
			return Result.ok(true);
		} catch (error) {
			return Result.err(CommandError.CommandExecutionFailed('setBrightness'));
		}
	}

	private mute(enabled: boolean): Result<boolean, CommandError> {
		try {
			deviceControl.symbols.mute(enabled);
			return Result.ok(true);
		} catch (error) {
			return Result.err(CommandError.CommandExecutionFailed('mute'));
		}
	}

	private lock(): Result<boolean, CommandError> {
		try {
			deviceControl.symbols.lock();
			return Result.ok(true);
		} catch (error) {
			return Result.err(CommandError.CommandExecutionFailed('lock'));
		}
	}

	private sleep(): Result<boolean, CommandError> {
		try {
			deviceControl.symbols.sleep();
			return Result.ok(true);
		} catch (error) {
			return Result.err(CommandError.CommandExecutionFailed('sleep'));
		}
	}

	private shutdown(): Result<boolean, CommandError> {
		try {
			deviceControl.symbols.shutdown();
			return Result.ok(true);
		} catch (error) {
			return Result.err(CommandError.CommandExecutionFailed('shutdown'));
		}
	}

	private restart(): Result<boolean, CommandError> {
		try {
			deviceControl.symbols.restart();
			return Result.ok(true);
		} catch (error) {
			return Result.err(CommandError.CommandExecutionFailed('restart'));
		}
	}

	// ─── Helper Methods ──────────────────────────────────────────────────────

	private async sendNativeMessage(
		message: Record<string, unknown>,
	): Promise<Result<boolean, CommandError>> {
		try {
			const json = JSON.stringify(message);
			const HOME = env.HOME! || env.USERPROFILE! || env.HOMEPATH!;

			if (!HOME) {
				return Result.err(CommandError.NativeMessageFailed('Home directory not found'));
			}

			await $`echo '${json}' > $HOME/setup/yumi-browser-integration/native-messaging-host/.native-messaging-host/control.json`
				.env({ ...env, HOME })
				.text();

			return Result.ok(true);
		} catch (error) {
			return Result.err(
				CommandError.NativeMessageFailed(
					error instanceof Error ? error.message : 'Failed to send native message',
				),
			);
		}
	}

	/**
	 * Check if media control is available
	 * @returns Result indicating if media control is available
	 */
	public isMediaControlAvailable(): Result<boolean, CommandError> {
		try {
			const trackResult = this.getCurrentTrack();
			return Result.ok(trackResult.isOk());
		} catch {
			return Result.err(CommandError.MediaControlUnavailable);
		}
	}

	/**
	 * Check if device control is available
	 * @returns Result indicating if device control is available
	 */
	public isDeviceControlAvailable(): Result<boolean, CommandError> {
		try {
			return Result.ok(!!deviceControl.symbols);
		} catch {
			return Result.err(CommandError.DeviceControlUnavailable);
		}
	}
}
