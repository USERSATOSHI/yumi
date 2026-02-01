/**
 * Local Module Imports
 */
import type Elysia from 'elysia';
import { createControlCommand, createMediaCommand } from '../command/index.js';
import ledfx, { LedFxScene, type LedFx } from '../integrations/ledfx';
import { devicePool } from '../pool/devices/index.js';
import { type ElysiaWS } from 'elysia/ws';
import { mediaStatePool } from '../pool/media/index.js';

/**
 * Change the scene of a WLED light using LEDfx.
 *
 * This function changes the scene of a WLED light identified by its hash this allows for changing the visuals of room lighting.
 *
 * @param params.deviceHash - unique identifier of the device that is running the LEDfx instance
 * @param params.sceneName - name of the scene to change to
 * @returns Result<void, Error> - Result object indicating success or failure
 *
 * @example
 * ```ts
 * // Make the room a bit cozy
 * await changeLedFxScene({ deviceHash: "device-hash-123", sceneName: 'cozy' });
 *
 * // Set a party mood
 * await changeLedFxScene({ deviceHash: "device-hash-123", sceneName: 'party' });
 *
 * // time for work
 * await changeLedFxScene({ deviceHash: "device-hash-123", sceneName: 'work' });
 *
 * // turn off the lights
 * await changeLedFxScene({ deviceHash: "device-hash-123", sceneName: 'sleep' });
 * ```
 */
export async function changeLedFxScene({
	deviceHash,
	sceneName,
}: {
	deviceHash: string;
	sceneName: Parameters<LedFx['switch']>[1];
}): Promise<string> {
	const result = await ledfx.switch(deviceHash, sceneName);
	return result.unwrap() || '';
}

/**
 * Get current time in local format.
 *
 * @intent TIME_GET
 * @returns string - Current time in local format
 *
 * @example
 * ```ts
 * getCurrentTime();
 * ```
 */
export function getCurrentTime(): string {
	return new Date().toLocaleString();
}

// media controls

/**
 * Play media
 *
 * @intent MEDIA_PLAY
 * @param params.hash - device Hash
 *
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function playMedia(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createMediaCommand('playMedia', {}, hash)));
	return true;
}

/**
 * Pause media
 *
 * @intent MEDIA_PAUSE
 * @param params.hash - device Hash
 *
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function pauseMedia(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}
	
	this.publish(hash, JSON.stringify(createMediaCommand('pauseMedia', {}, hash)));
	return true;
}

/**
 * Stop media
 *
 * @intent MEDIA_STOP
 * @param params.hash - device Hash
 *
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function stopMedia(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createMediaCommand('stop', {}, hash)));
	return true;
}

/**
 * Skip to next media track
 *
 * @intent MEDIA_NEXT
 * @param params.hash - device Hash
 *
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function nextMediaTrack(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createMediaCommand('nextTrack', {}, hash)));
	return true;
}

/**
 * Skip to previous media track
 *
 * @intent MEDIA_PREVIOUS
 * @param params.hash - device Hash
 *
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function previousMediaTrack(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createMediaCommand('previousTrack', {}, hash)));
	return true;
}

/**
 * Set media volume
 *
 * @intent MEDIA_VOLUME
 * @param params.hash - device Hash
 * @param params.volume - volume level (0-100)
 *
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function setMediaVolume(
	this: Elysia['server'],
	{ hash, volume }: { hash: string; volume: number },
): boolean {
	if (!hash) {
		return false;
	}

	console.log(this, this.publish)
	this.publish(hash, JSON.stringify(createControlCommand('volume', { level: volume / 100 }, hash)));
	return true;
}


// device controls

/**
 * Shutdown device
 * 
 * @intent DEVICE_SHUTDOWN
 * @param params.hash - device Hash
 * 
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function shutdownDevice(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createControlCommand('shutdown', {}, hash)));
	return true;
}

/**
 * Mute device
 * 
 * @intent DEVICE_MUTE
 * @param params.hash - device Hash
 * @param params.muted - mute state
 * 
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function muteDevice(
	this: ElysiaWS,
	{ hash, muted }: { hash: string; muted: boolean },
): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createControlCommand('mute', { muted }, hash)));
	return true;
}

/**
 * Sleep device
 * 
 * @intent DEVICE_SLEEP
 * @param params.hash - device Hash
 * @param params.duration - sleep duration in minutes
 * 
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function sleepDevice(
	this: ElysiaWS,
	{ hash, duration }: { hash: string; duration: number },
): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createControlCommand('sleep', { duration }, hash)));
	return true;
}

/**
 * Lock device
 * 
 * @intent DEVICE_LOCK
 * @param params.hash - device Hash
 * 
 * @this {ElysiaWS}
 * @returns boolean - success status
 */
export function lockDevice(this: ElysiaWS, { hash }: { hash: string }): boolean {
	if (!hash) {
		return false;
	}

	this.publish(hash, JSON.stringify(createControlCommand('lock', {}, hash)));
	return true;
}

// routines

/**
 * Good Night routine
 * 
 * @intent ROUTINE_GOOD_NIGHT
 * @this {ElysiaWS}
 * @returns string - result message
 */
export function goodNightRoutine(this: ElysiaWS): string {

	// change LEDfx scene to sleep
	const playingDevices = mediaStatePool.getPlayingDevices();
	for (const device of playingDevices) {
		changeLedFxScene({ deviceHash: device.hash, sceneName: LedFxScene.Sleep });
	}
	// shutdown all links
	shutdownDevice.call(this, { hash: 'link' });
	return 'Good Night routine executed: LEDfx set to sleep scene, all links shutting down.';
}