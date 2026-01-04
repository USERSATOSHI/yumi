import { useState, useEffect, useCallback } from 'react';
import {
	Add as AddIcon,
	Delete as DeleteIcon,
	NotificationsActive as ReminderIcon,
	CheckCircle as CheckCircleIcon,
	Repeat as RepeatIcon,
	Schedule as ScheduleIcon,
} from '@mui/icons-material';
import {
	IconButton,
	TextField,
	Button,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Select,
	MenuItem,
	FormControl,
	InputLabel,
} from '@mui/material';
import { api } from '../../api';
import './index.css';

interface Reminder {
	id: number;
	title: string;
	description: string | null;
	remind_at: number;
	repeat: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
	completed: number;
	created_at: number;
	updated_at: number;
}

function formatDateTime(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diff = timestamp - now.getTime();
	
	const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	
	// If in the past
	if (diff < 0) {
		const days = Math.abs(Math.floor(diff / (1000 * 60 * 60 * 24)));
		if (days === 0) return `Today at ${timeStr} (overdue)`;
		if (days === 1) return `Yesterday at ${timeStr}`;
		return `${days} days ago`;
	}
	
	// If upcoming
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	if (days === 0) return `Today at ${timeStr}`;
	if (days === 1) return `Tomorrow at ${timeStr}`;
	if (days < 7) return `In ${days} days at ${timeStr}`;
	
	return date.toLocaleDateString() + ' at ' + timeStr;
}

function getRepeatLabel(repeat: string | null): string {
	switch (repeat) {
		case 'daily': return 'Daily';
		case 'weekly': return 'Weekly';
		case 'monthly': return 'Monthly';
		case 'yearly': return 'Yearly';
		default: return '';
	}
}

export default function Reminders() {
	const [reminders, setReminders] = useState<Reminder[]>([]);
	const [dueReminders, setDueReminders] = useState<Reminder[]>([]);
	const [loading, setLoading] = useState(true);
	const [dialogOpen, setDialogOpen] = useState(false);
	
	// Form state
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [remindDate, setRemindDate] = useState('');
	const [remindTime, setRemindTime] = useState('');
	const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('none');

	const fetchReminders = useCallback(async () => {
		setLoading(true);
		const [upcomingRes, dueRes] = await Promise.all([
			api.get<{ data: Reminder[] }>('/api/reminders'),
			api.get<{ data: Reminder[] }>('/api/reminders/due'),
		]);
		
		if (upcomingRes.success && upcomingRes.data) {
			setReminders(upcomingRes.data.data);
		}
		if (dueRes.success && dueRes.data) {
			setDueReminders(dueRes.data.data);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		fetchReminders();
		// Poll for due reminders every 30 seconds
		const interval = setInterval(fetchReminders, 30000);
		return () => clearInterval(interval);
	}, [fetchReminders]);

	const handleComplete = async (reminder: Reminder) => {
		await api.post(`/api/reminders/${reminder.id}/complete`, {});
		fetchReminders();
	};

	const handleDelete = async (id: number) => {
		await api.delete(`/api/reminders/${id}`);
		fetchReminders();
	};

	const handleOpenDialog = () => {
		setTitle('');
		setDescription('');
		setRemindDate('');
		setRemindTime('');
		setRepeat('none');
		setDialogOpen(true);
	};

	const handleCloseDialog = () => {
		setDialogOpen(false);
	};

	const handleSubmit = async () => {
		if (!remindDate || !remindTime) return;
		
		const remindAt = new Date(`${remindDate}T${remindTime}`).getTime();
		
		await api.post('/api/reminders', {
			title,
			description: description || undefined,
			remindAt,
			repeat: repeat === 'none' ? undefined : repeat,
		});
		
		handleCloseDialog();
		fetchReminders();
	};

	return (
		<div className="reminders-page">
			<div className="reminders-header">
				<h2>Reminders</h2>
				<div className="reminders-actions">
					<Button
						variant="contained"
						startIcon={<AddIcon />}
						onClick={handleOpenDialog}
						sx={{ 
							background: '#f1f1f1', 
							color: '#1a1a1a',
							boxShadow: '5px 5px 0 #1a1a1a',
							'&:hover': { background: '#f5f5f5', boxShadow: '2px 2px 0 #1a1a1a' } 
						}}
					>
						Add Reminder
					</Button>
				</div>
			</div>

			{/* Due Reminders Section */}
			{dueReminders.length > 0 && (
				<div className="reminders-section due">
					<h3>
						<ReminderIcon sx={{ color: '#ef4444' }} />
						Due Now
					</h3>
					<div className="reminders-list">
						{dueReminders.map(reminder => (
							<div key={reminder.id} className="reminder-card due">
								<div className="reminder-card-shadow" />
								<div className="reminder-card-box">
									<div className="reminder-icon">
										<ReminderIcon />
									</div>
									
									<div className="reminder-content">
										<span className="reminder-title">{reminder.title}</span>
										{reminder.description && (
											<span className="reminder-description">{reminder.description}</span>
										)}
										<div className="reminder-meta">
											<span className="reminder-time overdue">
												<ScheduleIcon sx={{ fontSize: 14 }} />
												{formatDateTime(reminder.remind_at)}
											</span>
											{reminder.repeat && (
												<span className="reminder-repeat">
													<RepeatIcon sx={{ fontSize: 14 }} />
													{getRepeatLabel(reminder.repeat)}
												</span>
											)}
										</div>
									</div>
									
									<div className="reminder-actions">
										<IconButton
											onClick={() => handleComplete(reminder)}
											size="small"
											sx={{ color: '#22c55e' }}
										>
											<CheckCircleIcon />
										</IconButton>
										<IconButton
											onClick={() => handleDelete(reminder.id)}
											size="small"
											sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: '#ef4444' } }}
										>
											<DeleteIcon />
										</IconButton>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Upcoming Reminders Section */}
			<div className="reminders-section">
				<h3>
					<ScheduleIcon />
					Upcoming
				</h3>
				<div className="reminders-list">
					{loading ? (
						<div className="reminders-empty">Loading...</div>
					) : reminders.length === 0 ? (
						<div className="reminders-empty">
							<p>No upcoming reminders</p>
						</div>
					) : (
						reminders.map(reminder => (
							<div key={reminder.id} className="reminder-card">
								<div className="reminder-card-shadow" />
								<div className="reminder-card-box">
									<div className="reminder-icon">
										<ReminderIcon />
									</div>
									
									<div className="reminder-content">
										<span className="reminder-title">{reminder.title}</span>
										{reminder.description && (
											<span className="reminder-description">{reminder.description}</span>
										)}
										<div className="reminder-meta">
											<span className="reminder-time">
												<ScheduleIcon sx={{ fontSize: 14 }} />
												{formatDateTime(reminder.remind_at)}
											</span>
											{reminder.repeat && (
												<span className="reminder-repeat">
													<RepeatIcon sx={{ fontSize: 14 }} />
													{getRepeatLabel(reminder.repeat)}
												</span>
											)}
										</div>
									</div>
									
									<div className="reminder-actions">
										<IconButton
											onClick={() => handleComplete(reminder)}
											size="small"
											title="Complete"
										>
											<CheckCircleIcon />
										</IconButton>
										<IconButton
											onClick={() => handleDelete(reminder.id)}
											size="small"
											sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: '#ef4444' } }}
										>
											<DeleteIcon />
										</IconButton>
									</div>
								</div>
							</div>
						))
					)}
				</div>
			</div>

			<Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
				<DialogTitle>New Reminder</DialogTitle>
				<DialogContent>
					<TextField
						autoFocus
						margin="dense"
						label="Title"
						fullWidth
						variant="outlined"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
					<TextField
						margin="dense"
						label="Description"
						fullWidth
						variant="outlined"
						multiline
						rows={2}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
					<div style={{ display: 'flex', gap: 16 }}>
						<TextField
							margin="dense"
							label="Date"
							type="date"
							fullWidth
							variant="outlined"
							value={remindDate}
							onChange={(e) => setRemindDate(e.target.value)}
							InputLabelProps={{ shrink: true }}
						/>
						<TextField
							margin="dense"
							label="Time"
							type="time"
							fullWidth
							variant="outlined"
							value={remindTime}
							onChange={(e) => setRemindTime(e.target.value)}
							InputLabelProps={{ shrink: true }}
						/>
					</div>
					<FormControl fullWidth margin="dense">
						<InputLabel>Repeat</InputLabel>
						<Select
							value={repeat}
							label="Repeat"
							onChange={(e) => setRepeat(e.target.value as typeof repeat)}
						>
							<MenuItem value="none">Don't repeat</MenuItem>
							<MenuItem value="daily">Daily</MenuItem>
							<MenuItem value="weekly">Weekly</MenuItem>
							<MenuItem value="monthly">Monthly</MenuItem>
							<MenuItem value="yearly">Yearly</MenuItem>
						</Select>
					</FormControl>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCloseDialog}>Cancel</Button>
					<Button 
						onClick={handleSubmit} 
						variant="contained"
						disabled={!title.trim() || !remindDate || !remindTime}
						sx={{ 
							background: '#fff', 
							color: '#1a1a1a',
							boxShadow: '3px 3px 0 #1a1a1a',
							'&:hover': { background: '#f5f5f5', boxShadow: '2px 2px 0 #1a1a1a' } 
						}}
					>
						Add
					</Button>
				</DialogActions>
			</Dialog>
		</div>
	);
}
