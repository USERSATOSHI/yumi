import { useWebSocket, useCommand, useDeviceState } from '../../hooks/useWebSocket';
import { useStats } from '../../hooks/useApi';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useControlState } from '../../contexts/ControlContext';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import PauseRounded from '@mui/icons-material/PauseRounded';
import SkipPreviousRounded from '@mui/icons-material/SkipPreviousRounded';
import SkipNextRounded from '@mui/icons-material/SkipNextRounded';
import VolumeUpRounded from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRounded from '@mui/icons-material/VolumeOffRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import BedtimeRounded from '@mui/icons-material/BedtimeRounded';
import PowerSettingsNewRounded from '@mui/icons-material/PowerSettingsNewRounded';
import KeyboardArrowDownRounded from '@mui/icons-material/KeyboardArrowDownRounded';
import './index.css';

// Media controls - 2x2 layout
const MEDIA_CONTROLS = [
	{ fn: 'playMedia', Icon: PlayArrowRounded, title: 'Play' },
	{ fn: 'pauseMedia', Icon: PauseRounded, title: 'Pause' },
	{ fn: 'previousTrack', Icon: SkipPreviousRounded, title: 'Prev' },
	{ fn: 'nextTrack', Icon: SkipNextRounded, title: 'Next' },
];

// Quick action tiles
const QUICK_ACTIONS = [
	{ fn: 'mute', Icon: VolumeOffRounded, title: 'Mute' },
	{ fn: 'lock', Icon: LockRounded, title: 'Lock' },
	{ fn: 'sleep', Icon: BedtimeRounded, title: 'Sleep' },
	{ fn: 'shutdown', Icon: PowerSettingsNewRounded, title: 'Power' },
];

export default function Control() {
	const { isConnected, deviceHash } = useWebSocket();
	const { loading, execute, executeOnLinks } = useCommand();
	const { stats, fetchStats } = useStats();
	const { state, setSelectedDevice, setVolume, setBrightness } = useControlState();
	const [dropdownOpen, setDropdownOpen] = useState(false);

	const { selectedDevice, volume, brightness } = state;

	// Get device state from the selected device (or first link if 'all')
	const selectedDeviceHash = selectedDevice === 'all' ? undefined : selectedDevice;
	const deviceState = useDeviceState(selectedDeviceHash);

	// Update local state when device state is received
	useEffect(() => {
		if (deviceState) {
			setVolume(deviceState.volume);
			setBrightness(deviceState.brightness);
		}
	}, [deviceState]);

	useEffect(() => {
		fetchStats();
		const interval = setInterval(fetchStats, 10000);
		return () => clearInterval(interval);
	}, [fetchStats]);

	const linkDevices = useMemo(() => {
		if (!stats?.devices?.devices) return [];
		return stats.devices.devices.filter(
			(d) => d.type.toLowerCase() === 'link' && d.online
		);
	}, [stats?.devices?.devices]);

	const selectedDeviceName = useMemo(() => {
		if (selectedDevice === 'all') return 'All Devices';
		const device = linkDevices.find((d) => d.hash === selectedDevice);
		return device?.name || 'Unknown';
	}, [selectedDevice, linkDevices]);

	const handleCommand = (fn: string, args?: Record<string, unknown>) => {
		if (selectedDevice === 'all') {
			executeOnLinks(fn, args ?? {});
		} else {
			execute(fn, selectedDevice, args ?? {});
		}
	};

	const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value);
		setVolume(val);
		handleCommand('volume', { level: val / 100 });
	}, [selectedDevice]);

	const handleBrightnessChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const val = Number(e.target.value);
		setBrightness(val);
		handleCommand('brightness', { level: val });
	}, [selectedDevice]);

	return (
		<div className="control-page">
			{/* Connection Status */}
			<div className="control-section">
				<div className="control-widget">
					<div className="control-widget-shadow" />
					<div className="control-widget-box">
						<h3>Connection</h3>
						<div className="connection-status">
							<div className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
							<span>{isConnected ? 'Connected' : 'Disconnected'}</span>
						</div>
						<p className="device-hash">ID: {deviceHash.slice(0, 16)}...</p>
					</div>
				</div>
			</div>

			{/* Controls */}
			<div className="control-section">
				<div className="control-widget">
					<div className="control-widget-shadow" />
					<div className="control-widget-box">
						{/* Header with dropdown */}
						<div className="controls-header">
							<h3>Controls</h3>
							<div className="device-dropdown-wrapper">
								<button
									className="device-dropdown-btn"
									onClick={() => setDropdownOpen(!dropdownOpen)}
								>
									<div className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
									<span>{selectedDeviceName}</span>
									<KeyboardArrowDownRounded className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`} />
								</button>
								{dropdownOpen && (
									<div className="device-dropdown-menu">
										<button
											className={`dropdown-item ${selectedDevice === 'all' ? 'active' : ''}`}
											onClick={() => { setSelectedDevice('all'); setDropdownOpen(false); }}
										>
											All Devices
										</button>
										{linkDevices.map((device) => (
											<button
												key={device.hash}
												className={`dropdown-item ${selectedDevice === device.hash ? 'active' : ''}`}
												onClick={() => { setSelectedDevice(device.hash); setDropdownOpen(false); }}
											>
												{device.name}
											</button>
										))}
									</div>
								)}
							</div>
						</div>

						{/* Media - 2x2 */}
						<div className="media-grid">
							{MEDIA_CONTROLS.map((cmd) => (
								<button
									key={cmd.fn}
									className="media-btn"
									onClick={() => handleCommand(cmd.fn)}
									disabled={loading || !isConnected}
									title={cmd.title}
								>
									{/* <span className="media-btn-shadow" /> */}
									<span className="media-btn-face">
										<cmd.Icon className="media-btn-icon" />
									</span>
								</button>
							))}
						</div>

						{/* Sliders */}
						<div className="sliders-section">
							<div className="slider-row">
								<VolumeUpRounded className="slider-icon" />
								<input
									type="range"
									min="0"
									max="100"
									value={volume}
									onChange={handleVolumeChange}
									className="control-slider"
									disabled={!isConnected}
								/>
								<span className="slider-value">{volume}%</span>
							</div>
							<div className="slider-row">
								<LightModeRounded className="slider-icon" />
								<input
									type="range"
									min="0"
									max="100"
									value={brightness}
									onChange={handleBrightnessChange}
									className="control-slider"
									disabled={!isConnected}
								/>
								<span className="slider-value">{brightness}%</span>
							</div>
						</div>

						{/* Quick Actions - 4 tiles */}
						<div className="controls-grid">
							{QUICK_ACTIONS.map((cmd) => (
								<button
									key={cmd.fn}
									className="control-tile"
									onClick={() => handleCommand(cmd.fn)}
									disabled={loading || !isConnected}
									title={cmd.title}
								>
									{/* <span className="control-tile-shadow" /> */}
									<span className="control-tile-face">
										<cmd.Icon className="control-tile-icon" />
									</span>
								</button>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Connected Devices */}
			{stats?.devices && (
				<div className="control-section">
					<div className="control-widget">
						<div className="control-widget-shadow" />
						<div className="control-widget-box">
							<h3>Devices ({stats.devices.online}/{stats.devices.total})</h3>
							<div className="device-list">
								{stats.devices.devices.map((device) => (
									<div key={device.hash} className="device-item">
										<div className={`status-dot ${device.online ? 'online' : 'offline'}`} />
										<span className="device-name">{device.name}</span>
										<span className="device-type">{device.type}</span>
									</div>
								))}
								{stats.devices.devices.length === 0 && (
									<p className="no-devices">No devices connected</p>
								)}
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}