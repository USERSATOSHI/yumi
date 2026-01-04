import { useState, useEffect, useCallback } from 'react';
import { wsService } from '../services/ws';
import { WSType, type WSData, type MusicWSData, type DeviceStateWSData } from '../types/ws';

// Hook for WebSocket connection status
export function useWebSocket() {
	const [isConnected, setIsConnected] = useState(wsService.isConnected);

	useEffect(() => {
		const unsubConnect = wsService.onConnect(() => setIsConnected(true));
		const unsubDisconnect = wsService.onDisconnect(() => setIsConnected(false));

		return () => {
			unsubConnect();
			unsubDisconnect();
		};
	}, []);

	const sendControl = useCallback(
		(fn: string, targetHash: string, args?: Record<string, unknown>) => {
			wsService.sendControl(fn, targetHash, args);
		},
		[]
	);

	const sendToLinks = useCallback((fn: string, args?: Record<string, unknown>) => {
		wsService.sendToLinks(fn, args);
	}, []);

	return {
		isConnected,
		deviceHash: wsService.deviceHash,
		sendControl,
		sendToLinks,
	};
}

// Hook for subscribing to WebSocket messages
export function useWSMessages(filter?: (data: WSData) => boolean) {
	const [lastMessage, setLastMessage] = useState<WSData | null>(null);

	useEffect(() => {
		const unsub = wsService.onMessage((data) => {
			if (!filter || filter(data)) {
				setLastMessage(data);
			}
		});

		return unsub;
	}, [filter]);

	return lastMessage;
}

// Hook specifically for music updates
export function useMusicUpdates() {
	const [music, setMusic] = useState<MusicWSData['data'] | null>(null);

	useEffect(() => {
		const unsub = wsService.onMessage((data) => {
			if (data.type === WSType.Music) {
				setMusic(data.data);
			}
		});

		return unsub;
	}, []);

	return music;
}

// Hook for music updates per device (tracks all devices)
export function useDevicesMusic() {
	const [musicByDevice, setMusicByDevice] = useState<Map<string, MusicWSData['data']>>(new Map());
	const apiBaseUrl = import.meta.env.VITE_API_URL || 'https://yumi.home.usersatoshi.in';

	useEffect(() => {
		const unsub = wsService.onMessage((data) => {
			if (data.type === WSType.Music) {
				setMusicByDevice((prev) => {
					const next = new Map(prev);
					const existing = prev.get(data.data.hash);
					
					// Merge with existing data, preserving fields not in update
					const newData = { ...existing, ...data.data };
					
					// Handle artwork: null means clear, undefined means keep existing
					// Also prepend API base URL if it's a relative path
					if (data.data.artwork === null) {
						newData.artwork = undefined;
					} else if (data.data.artwork === undefined && existing?.artwork) {
						newData.artwork = existing.artwork;
					} else if (data.data.artwork && data.data.artwork.startsWith('/')) {
						// Relative URL from core - prepend base URL
						// Use track key as cache buster so same track = cached, different track = new fetch
						const trackKey = encodeURIComponent(`${data.data.title || ''}|${data.data.artist || ''}`);
						newData.artwork = `${apiBaseUrl}${data.data.artwork}?t=${trackKey}`;
					}
					
					next.set(data.data.hash, newData);
					return next;
				});
			}
		});

		return unsub;
	}, [apiBaseUrl]);

	return musicByDevice;
}

// Hook for device state updates (volume, brightness)
export function useDeviceState(deviceHash?: string) {
	const [deviceState, setDeviceState] = useState<{ volume: number; brightness: number } | null>(null);

	useEffect(() => {
		const unsub = wsService.onMessage((data) => {
			if (data.type === WSType.DeviceState) {
				const stateData = data as DeviceStateWSData;
				// If no specific device hash, take the first one or match by hash
				if (!deviceHash || stateData.data.hash === deviceHash) {
					setDeviceState({
						volume: stateData.data.volume,
						brightness: stateData.data.brightness,
					});
				}
			}
		});

		return unsub;
	}, [deviceHash]);

	return deviceState;
}

// Hook for all device states (volume, brightness) per device
export function useAllDeviceStates() {
	const [statesByDevice, setStatesByDevice] = useState<Map<string, { volume: number; brightness: number }>>(new Map());

	useEffect(() => {
		const unsub = wsService.onMessage((data) => {
			if (data.type === WSType.DeviceState) {
				const stateData = data as DeviceStateWSData;
				setStatesByDevice((prev) => {
					const next = new Map(prev);
					next.set(stateData.data.hash, {
						volume: stateData.data.volume,
						brightness: stateData.data.brightness,
					});
					return next;
				});
			}
		});

		return unsub;
	}, []);

	return statesByDevice;
}

// Hook for sending commands with feedback
export function useCommand() {
	const [loading, setLoading] = useState(false);

	const execute = useCallback(
		(fn: string, targetHash: string, args?: Record<string, unknown>) => {
			setLoading(true);
			wsService.sendControl(fn, targetHash, args);
			// Reset loading after a short delay since we don't get response confirmation
			setTimeout(() => setLoading(false), 500);
		},
		[]
	);

	const executeOnLinks = useCallback((fn: string, args?: Record<string, unknown>) => {
		setLoading(true);
		wsService.sendToLinks(fn, args);
		setTimeout(() => setLoading(false), 500);
	}, []);

	return { loading, execute, executeOnLinks };
}
