import { useState, useEffect } from 'react';
import { useStats } from '../../hooks/useApi';
import './index.css';

export default function StatsMenu() {
	const [isOpen, setIsOpen] = useState(false);
	const { loading, stats, fetchStats } = useStats();

	// Fetch stats when menu opens
	useEffect(() => {
		if (isOpen) {
			fetchStats();
		}
	}, [isOpen, fetchStats]);

	// Auto-refresh stats every 10 seconds when open
	useEffect(() => {
		if (!isOpen) return;

		const interval = setInterval(() => {
			fetchStats();
		}, 10000);

		return () => clearInterval(interval);
	}, [isOpen, fetchStats]);

	const formatUptime = (seconds: number) => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		return `${hours}h ${minutes}m`;
	};

	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	return (
		<div className="stats-menu-container">
			{/* Toggle Button */}
			<button
				className={`stats-menu-toggle ${isOpen ? 'open' : ''}`}
				onClick={() => setIsOpen(!isOpen)}
				title={isOpen ? 'Close stats' : 'Open stats'}
				aria-label={isOpen ? 'Close stats' : 'Open stats'}
			>
				<div className="stats-menu-toggle-shadow" />
				<div className="stats-menu-toggle-box">
					<div className="stats-menu-toggle-icon">
						<span></span>
						<span></span>
						<span></span>
					</div>
				</div>
			</button>

			{/* Sliding Panel */}
			<div className={`stats-panel ${isOpen ? 'open' : ''}`}>
				{loading && !stats ? (
					<div className="stats-loading">Loading...</div>
				) : stats ? (
					<div className="stats-content">
						{/* System Stats Widget */}
						<div className="stats-widget">
							<div className="stats-widget-shadow" />
							<div className="stats-widget-box">
								<h3>System</h3>
								<div className="stats-row">
									<span className="stats-label">Uptime</span>
									<span className="stats-value">{formatUptime(stats.core.uptimeSeconds)}</span>
								</div>
								<div className="stats-row">
									<span className="stats-label">Memory</span>
									<span className="stats-value">
										{stats.core.memoryUsedMb.toFixed(0)} / {stats.core.memoryTotalMb.toFixed(0)} MB
									</span>
								</div>
								<div className="stats-row">
									<span className="stats-label">Connections</span>
									<span className="stats-value">{stats.core.activeConnections}</span>
								</div>
							</div>
						</div>

						{/* Device Stats Widget */}
						<div className="stats-widget">
							<div className="stats-widget-shadow" />
							<div className="stats-widget-box">
								<h3>Devices</h3>
								<div className="stats-row">
									<span className="stats-label">Online</span>
									<span className="stats-value stats-online">{stats.devices.online}</span>
								</div>
								<div className="stats-row">
									<span className="stats-label">Offline</span>
									<span className="stats-value stats-offline">{stats.devices.offline}</span>
								</div>
								<div className="stats-row">
									<span className="stats-label">Total</span>
									<span className="stats-value">{stats.devices.total}</span>
								</div>
								{stats.devices.lastActivity && (
									<div className="stats-row">
										<span className="stats-label">Last Active</span>
										<span className="stats-value">{stats.devices.lastActivity.deviceName}</span>
									</div>
								)}
							</div>
						</div>

						{/* Command Stats Widget */}
						<div className="stats-widget">
							<div className="stats-widget-shadow" />
							<div className="stats-widget-box">
								<h3>Commands</h3>
								<div className="stats-row">
									<span className="stats-label">Today</span>
									<span className="stats-value">{stats.commands.totalToday}</span>
								</div>
								<div className="stats-row">
									<span className="stats-label">Success</span>
									<span className="stats-value stats-online">{stats.commands.successCount}</span>
								</div>
								<div className="stats-row">
									<span className="stats-label">Failed</span>
									<span className="stats-value stats-offline">{stats.commands.failCount}</span>
								</div>
								{stats.commands.mostUsed && (
									<div className="stats-row">
										<span className="stats-label">Most Used</span>
										<span className="stats-value">{stats.commands.mostUsed.name}</span>
									</div>
								)}
								{stats.commands.lastExecuted && (
									<div className="stats-row">
										<span className="stats-label">Last Run</span>
										<span className="stats-value">{formatTime(stats.commands.lastExecuted.at)}</span>
									</div>
								)}
							</div>
						</div>
					</div>
				) : (
					<div className="stats-error">Failed to load stats</div>
				)}
			</div>
		</div>
	);
}
