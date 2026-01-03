/**
 * External Dependencies
 */
import { existsSync } from 'node:fs';
import { dlopen, FFIType, suffix } from 'bun:ffi';

/**
 * Determine the correct library path based on platform
 */
function getLibraryPath(libName: string): string {
	const isWindows = process.platform === 'win32';
	const prefix = isWindows ? '' : 'lib';
	const basePath = `./build/Release/${prefix}${libName}.${suffix}`;
	const fallbackPath = `./build/${prefix}${libName}.${suffix}`;

	// Check if the library exists in the expected location
	if (existsSync(basePath)) {
		return basePath;
	} else if (existsSync(fallbackPath)) {
		return fallbackPath;
	} else {
		// Return the expected path and let dlopen handle the error
		return basePath;
	}
}

/**
 * Media control FFI bindings
 */
export const mediaControlLib = dlopen(getLibraryPath('media_control'), {
	playMedia: { args: [], returns: FFIType.bool },
	pauseMedia: { args: [], returns: FFIType.bool },
	nextTrack: { args: [], returns: FFIType.bool },
	previousTrack: { args: [], returns: FFIType.bool },
	seekTo: { args: [FFIType.cstring], returns: FFIType.bool },
	getCurrentTrackInfo: { args: [], returns: FFIType.cstring },
});

/**
 * Device control FFI bindings
 */
export const deviceControl = dlopen(getLibraryPath('device_control'), {
	getVolume: { args: [], returns: FFIType.f32 },
	volume: { args: [FFIType.f32], returns: FFIType.void },
	mute: { args: [FFIType.bool], returns: FFIType.void },
	getBrightness: { args: [], returns: FFIType.i32 },
	brightness: { args: [FFIType.i32], returns: FFIType.void },
	lock: { args: [], returns: FFIType.void },
	sleep: { args: [], returns: FFIType.void },
	shutdown: { args: [], returns: FFIType.void },
	restart: { args: [], returns: FFIType.void },
});
