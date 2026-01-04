import { useState, useEffect, useCallback } from 'react';
import { useStats } from '../../hooks/useApi';
import { useDevicesMusic, useAllDeviceStates, useWebSocket } from '../../hooks/useWebSocket';
import {
	ExpandMore as ExpandMoreIcon,
	Computer as ComputerIcon,
	Smartphone as SmartphoneIcon,
	Dns as ServerIcon,
	VolumeUp as VolumeIcon,
	Brightness6 as BrightnessIcon,
	MusicNote as MusicIcon,
	PlayArrow as PlayIcon,
	Pause as PauseIcon,
	Stop as StopIcon,
} from '@mui/icons-material';
import { Slider } from '@mui/material';
import './index.css';

interface DeviceInfo {
	hash: string;
	name: string;
	type: string;
	online: boolean;
	lastSeen: number;
}

function formatLastSeen(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	if (diff < 60000) return 'Just now';
	if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
	if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
	return `${Math.floor(diff / 86400000)}d ago`;
}

function formatDuration(value: number | string | undefined): string {
	if (value === undefined) return '0:00';

	// If it's already formatted as string (e.g., "3:45")
	if (typeof value === 'string' && value.includes(':')) return value;

	// If it's a number (seconds)
	const seconds = typeof value === 'string' ? parseInt(value) : value;
	if (isNaN(seconds)) return '0:00';

	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getDeviceIcon(type: string) {
	switch (type.toLowerCase()) {
		case 'link':
			return <ComputerIcon />;
		case 'deck':
			return <SmartphoneIcon />;
		case 'server':
			return <ServerIcon />;
		default:
			return <ComputerIcon />;
	}
}

function getPlaybackIcon(status?: string) {
	switch (status?.toLowerCase()) {
		case 'playing':
			return <PlayIcon className="playback-icon playing" />;
		case 'paused':
			return <PauseIcon className="playback-icon paused" />;
		default:
			return <StopIcon className="playback-icon stopped" />;
	}
}

interface DeviceCardProps {
	device: DeviceInfo;
	music: {
		title?: string;
		artist?: string;
		duration?: number;
		position?: number;
		durationFormatted?: string;
		positionFormatted?: string;
		status?: string;
		artwork?: string | null;
	} | null;
	deviceState: { volume: number; brightness: number } | null;
	expanded: boolean;
	onToggle: () => void;
	onSeek: (position: number) => void;
}

function DeviceCard({ device, music, deviceState, expanded, onToggle, onSeek }: DeviceCardProps) {
	const hasMusic = music && (music.title || music.artist);
	const position = typeof music?.position === 'number' ? music.position : 0;
	const duration = typeof music?.duration === 'number' ? music.duration : 0;

	const handleSliderChange = useCallback((_event: Event | React.SyntheticEvent, value: number | number[]) => {
		const newPosition = Array.isArray(value) ? value[0] : value;
		onSeek(newPosition);
	}, [onSeek]);

	return (
		<div className={`device-card ${expanded ? 'expanded' : ''} ${device.online ? 'online' : 'offline'}`}>
			<div className="device-card-shadow" />
			<div className="device-card-box">
				<button className="device-card-header" onClick={onToggle}>
					<div className="device-info">
						<div className="device-icon">{getDeviceIcon(device.type)}</div>
						<div className="device-details">
							<span className="device-name">{device.name}</span>
							<span className="device-type">{device.type}</span>
						</div>
					</div>
					<div className="device-status">
						<span className={`status-dot ${device.online ? 'online' : 'offline'}`} />
						<span className="last-seen">{device.online ? 'Online' : formatLastSeen(device.lastSeen)}</span>
						<ExpandMoreIcon className={`expand-icon ${expanded ? 'expanded' : ''}`} />
					</div>
				</button>

				{expanded && (
					<div className="device-card-content">
						{/* Device State Section */}
						{deviceState && (
							<div className="device-state-section">
								<h4>Device State</h4>
								<div className="state-items">
									<div className="state-item">
										<VolumeIcon />
										<div className="state-bar">
											<div className="state-bar-fill" style={{ width: `${deviceState.volume}%` }} />
										</div>
										<span className="state-value">{deviceState.volume}%</span>
									</div>
									<div className="state-item">
										<BrightnessIcon />
										<div className="state-bar">
											<div className="state-bar-fill brightness" style={{ width: `${deviceState.brightness}%` }} />
										</div>
										<span className="state-value">{deviceState.brightness}%</span>
									</div>
								</div>
							</div>
						)}

						{/* Media Section */}
						{device.type.toLowerCase() === 'link' && (
							<div className="media-section">
								<h4>
									<MusicIcon /> Now Playing
								</h4>
								{hasMusic ? (
									<div className="media-info">
										<div className="media-artwork">
											{music.artwork ? (
												<img src={music.artwork} alt="Album art" onError={(e) => {
													(e.target as HTMLImageElement).style.display = 'none';
												}} />
											) : (
												<div className="media-artwork-placeholder">
													<MusicIcon />
												</div>
											)}
										</div>
										<div className="media-details">
										<div className="media-header">
											{getPlaybackIcon(music.status)}
											<div className="media-text">
												<span className="media-title">{music.title || 'Unknown Track'}</span>
												<span className="media-artist">{music.artist || 'Unknown Artist'}</span>
											</div>
										</div>
										<div className="media-progress">
											<Slider
												value={position}
												min={0}
												max={duration || 1}
												onChangeCommitted={handleSliderChange}
												size="small"
												sx={{
													color: '#1a1a1a',
													'& .MuiSlider-thumb': {
														width: 12,
														height: 12,
													},
													'& .MuiSlider-rail': {
														background: '#e0e0e0',
													},
												}}
											/>
											<div className="progress-times">
												<span>{music.positionFormatted || formatDuration(position)}</span>
												<span>{music.durationFormatted || formatDuration(duration)}</span>
											</div>
										</div>
									</div>
								</div>
							) : (
								<div className="media-empty">
									<MusicIcon />
									<span>No media playing</span>
								</div>
							)}
						</div>
					)}

					{/* Device Info */}
					<div className="device-meta">
						<div className="meta-item">
							<span className="meta-label">Hash</span>
							<span className="meta-value">{device.hash.slice(0, 16)}...</span>
						</div>
						<div className="meta-item">
							<span className="meta-label">Last Activity</span>
							<span className="meta-value">{new Date(device.lastSeen).toLocaleString()}</span>
						</div>
					</div>
				</div>
			)}
			</div>
		</div>
	);
}

export default function Devices() {
	const { stats, fetchStats } = useStats();
	const musicByDevice = useDevicesMusic();
	const statesByDevice = useAllDeviceStates();
	const { sendControl } = useWebSocket();
	const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

	useEffect(() => {
		fetchStats();
		// Refresh stats every 30 seconds
		const interval = setInterval(fetchStats, 30000);
		return () => clearInterval(interval);
	}, [fetchStats]);

	const devices = stats?.devices.devices || [];

	const handleToggle = (hash: string) => {
		setExpandedDevice((prev) => (prev === hash ? null : hash));
	};

	const handleSeek = useCallback((deviceHash: string, position: number) => {
		sendControl('seekTo', deviceHash, { position: position.toString() });
	}, [sendControl]);

	return (
		<div className="devices-page">
			<div className="devices-header">
				<div className="devices-summary">
					<span className="summary-item online">
						<span className="status-dot online" />
						{stats?.devices.online || 0} Online
					</span>
					<span className="summary-item offline">
						<span className="status-dot offline" />
						{stats?.devices.offline || 0} Offline
					</span>
				</div>
			</div>

			<div className="devices-list">
				{devices.length === 0 ? (
					<div className="devices-empty">
						<div className="devices-empty-shadow" />
						<div className="devices-empty-box">
							<ComputerIcon />
							<p>No devices connected</p>
						</div>
					</div>
				) : (
					devices.map((device) => (
						<DeviceCard
							key={device.hash}
							device={device}
							music={musicByDevice.get(device.hash) || null}
							deviceState={statesByDevice.get(device.hash) || null}
							expanded={expandedDevice === device.hash}
							onToggle={() => handleToggle(device.hash)}
							onSeek={(position) => handleSeek(device.hash, position)}
						/>
					))
				)}
			</div>
		</div>
	);
}