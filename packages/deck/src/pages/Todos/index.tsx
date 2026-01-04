import { useState, useEffect, useCallback } from 'react';
import {
	Add as AddIcon,
	Delete as DeleteIcon,
	CheckCircle as CheckCircleIcon,
	RadioButtonUnchecked as UncheckedIcon,
	Flag as FlagIcon,
	Schedule as ScheduleIcon,
	Clear as ClearIcon,
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
	Chip,
} from '@mui/material';
import { api } from '../../api';
import './index.css';

interface Todo {
	id: number;
	title: string;
	description: string | null;
	priority: 'low' | 'medium' | 'high';
	due_at: number | null;
	completed: number;
	completed_at: number | null;
	created_at: number;
	updated_at: number;
}

type FilterType = 'all' | 'active' | 'completed' | 'overdue';

function formatDate(timestamp: number | null): string {
	if (!timestamp) return '';
	const date = new Date(timestamp);
	const now = new Date();
	const diff = timestamp - now.getTime();
	
	// If overdue
	if (diff < 0) {
		const days = Math.abs(Math.floor(diff / (1000 * 60 * 60 * 24)));
		if (days === 0) return 'Overdue today';
		if (days === 1) return 'Overdue by 1 day';
		return `Overdue by ${days} days`;
	}
	
	// If upcoming
	const days = Math.floor(diff / (1000 * 60 * 60 * 24));
	if (days === 0) return 'Due today';
	if (days === 1) return 'Due tomorrow';
	if (days < 7) return `Due in ${days} days`;
	
	return date.toLocaleDateString();
}

function getPriorityColor(priority: string): string {
	switch (priority) {
		case 'high': return '#ef4444';
		case 'medium': return '#f59e0b';
		case 'low': return '#22c55e';
		default: return '#6b7280';
	}
}

export default function Todos() {
	const [todos, setTodos] = useState<Todo[]>([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState<FilterType>('all');
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
	
	// Form state
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
	const [dueDate, setDueDate] = useState('');

	const fetchTodos = useCallback(async () => {
		setLoading(true);
		const response = await api.get<{ data: Todo[] }>('/api/todos?includeCompleted=true');
		if (response.success && response.data) {
			setTodos(response.data.data);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		fetchTodos();
	}, [fetchTodos]);

	const handleToggleComplete = async (todo: Todo) => {
		const endpoint = todo.completed 
			? `/api/todos/${todo.id}/uncomplete`
			: `/api/todos/${todo.id}/complete`;
		await api.post(endpoint, {});
		fetchTodos();
	};

	const handleDelete = async (id: number) => {
		await api.delete(`/api/todos/${id}`);
		fetchTodos();
	};

	const handleOpenDialog = (todo?: Todo) => {
		if (todo) {
			setEditingTodo(todo);
			setTitle(todo.title);
			setDescription(todo.description || '');
			setPriority(todo.priority);
			setDueDate(todo.due_at ? new Date(todo.due_at).toISOString().split('T')[0] : '');
		} else {
			setEditingTodo(null);
			setTitle('');
			setDescription('');
			setPriority('medium');
			setDueDate('');
		}
		setDialogOpen(true);
	};

	const handleCloseDialog = () => {
		setDialogOpen(false);
		setEditingTodo(null);
	};

	const handleSubmit = async () => {
		const dueAt = dueDate ? new Date(dueDate).getTime() : undefined;
		
		if (editingTodo) {
			await api.put(`/api/todos/${editingTodo.id}`, {
				title,
				description: description || undefined,
				priority,
				dueAt: dueAt ?? null,
			});
		} else {
			await api.post('/api/todos', {
				title,
				description: description || undefined,
				priority,
				dueAt,
			});
		}
		
		handleCloseDialog();
		fetchTodos();
	};

	const handleClearCompleted = async () => {
		await api.delete('/api/todos/completed');
		fetchTodos();
	};

	const filteredTodos = todos.filter(todo => {
		switch (filter) {
			case 'active': return !todo.completed;
			case 'completed': return todo.completed;
			case 'overdue': return !todo.completed && todo.due_at && todo.due_at < Date.now();
			default: return true;
		}
	});

	const activeTodos = todos.filter(t => !t.completed).length;
	const completedTodos = todos.filter(t => t.completed).length;

	return (
		<div className="todos-page">
			<div className="todos-header">
				<h2>Todos</h2>
				<div className="todos-actions">
					<Button
						variant="contained"
						startIcon={<AddIcon />}
						onClick={() => handleOpenDialog()}
						sx={{ 
							background: '#f1f1f1', 
							color: '#1a1a1a',
							boxShadow: '5px 5px 0 #1a1a1a',
							'&:hover': { background: '#f5f5f5', boxShadow: '2px 2px 0 #1a1a1a' } 
						}}
					>
						Add Todo
					</Button>
				</div>
			</div>

			<div className="todos-filters">
				<Chip
					label={`All (${todos.length})`}
					onClick={() => setFilter('all')}
					variant={filter === 'all' ? 'filled' : 'outlined'}
					sx={filter === 'all' ? { background: '#f1f1f1', color: '#1a1a1a', boxShadow: '5px 5px 0 #1a1a1a' } : {}}
				/>
				<Chip
					label={`Active (${activeTodos})`}
					onClick={() => setFilter('active')}
					variant={filter === 'active' ? 'filled' : 'outlined'}
					sx={filter === 'active' ? { background: '#f1f1f1', color: '#1a1a1a', boxShadow: '5px 5px 0 #1a1a1a' } : {}}
				/>
				<Chip
					label={`Completed (${completedTodos})`}
					onClick={() => setFilter('completed')}
					variant={filter === 'completed' ? 'filled' : 'outlined'}
					sx={filter === 'completed' ? { background: '#f1f1f1', color: '#1a1a1a', boxShadow: '5px 5px 0 #1a1a1a' } : {}}
				/>
				{completedTodos > 0 && (
					<Button
						size="small"
						startIcon={<ClearIcon />}
						onClick={handleClearCompleted}
						sx={{ marginLeft: 'auto', color: '#666' }}
					>
						Clear Completed
					</Button>
				)}
			</div>

			<div className="todos-list">
				{loading ? (
					<div className="todos-empty">Loading...</div>
				) : filteredTodos.length === 0 ? (
					<div className="todos-empty">
						<p>No todos found</p>
					</div>
				) : (
					filteredTodos.map(todo => (
						<div 
							key={todo.id} 
							className={`todo-card ${todo.completed ? 'completed' : ''}`}
							onClick={() => handleOpenDialog(todo)}
						>
							<div className="todo-card-shadow" />
							<div className="todo-card-box">
								<IconButton
									onClick={(e) => {
										e.stopPropagation();
										handleToggleComplete(todo);
									}}
									size="small"
								>
									{todo.completed ? (
										<CheckCircleIcon sx={{ color: '#22c55e' }} />
									) : (
										<UncheckedIcon />
									)}
								</IconButton>
								
								<div className="todo-content">
									<span className={`todo-title ${todo.completed ? 'completed' : ''}`}>
										{todo.title}
									</span>
									{todo.description && (
										<span className="todo-description">{todo.description}</span>
									)}
									<div className="todo-meta">
										<span 
											className="todo-priority"
											style={{ color: getPriorityColor(todo.priority) }}
										>
											<FlagIcon sx={{ fontSize: 14 }} />
											{todo.priority}
										</span>
										{todo.due_at && (
											<span className={`todo-due ${todo.due_at < Date.now() && !todo.completed ? 'overdue' : ''}`}>
												<ScheduleIcon sx={{ fontSize: 14 }} />
												{formatDate(todo.due_at)}
											</span>
										)}
									</div>
								</div>
								
								<IconButton
									onClick={(e) => {
										e.stopPropagation();
										handleDelete(todo.id);
									}}
									size="small"
									sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: '#ef4444' } }}
								>
									<DeleteIcon />
								</IconButton>
							</div>
						</div>
					))
				)}
			</div>

			<Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
				<DialogTitle>{editingTodo ? 'Edit Todo' : 'New Todo'}</DialogTitle>
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
						rows={3}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
					<FormControl fullWidth margin="dense">
						<InputLabel>Priority</InputLabel>
						<Select
							value={priority}
							label="Priority"
							onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
						>
							<MenuItem value="low">Low</MenuItem>
							<MenuItem value="medium">Medium</MenuItem>
							<MenuItem value="high">High</MenuItem>
						</Select>
					</FormControl>
					<TextField
						margin="dense"
						label="Due Date"
						type="date"
						fullWidth
						variant="outlined"
						value={dueDate}
						onChange={(e) => setDueDate(e.target.value)}
						InputLabelProps={{ shrink: true }}
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCloseDialog}>Cancel</Button>
					<Button 
						onClick={handleSubmit} 
						variant="contained"
						disabled={!title.trim()}
						sx={{ 
							background: '#fff', 
							color: '#1a1a1a',
							boxShadow: '3px 3px 0 #1a1a1a',
							'&:hover': { background: '#f5f5f5', boxShadow: '2px 2px 0 #1a1a1a' } 
						}}
					>
						{editingTodo ? 'Save' : 'Add'}
					</Button>
				</DialogActions>
			</Dialog>
		</div>
	);
}
