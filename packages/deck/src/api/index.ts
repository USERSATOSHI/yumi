const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://yumi.home.usersatoshi.in';

interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}

interface VoiceCommandPayload {
	text: string;
	speaker: number;
}

interface SpeakApiResponse {
	jp: string;
	en: string;
	audio: string;
}

class ApiService {
	private baseUrl: string;

	constructor(baseUrl: string = API_BASE_URL) {
		this.baseUrl = baseUrl;
	}

	private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
		try {
			const response = await fetch(`${this.baseUrl}${endpoint}`, {
				headers: {
					'Content-Type': 'application/json',
					...options.headers,
				},
				...options,
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			return { success: true, data };
		} catch (error) {
			console.error(`API request failed: ${endpoint}`, error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	// GET request
	async get<T>(endpoint: string): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, { method: 'GET' });
	}

	// POST request
	async post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, {
			method: 'POST',
			body: JSON.stringify(body),
			headers: {
				'x-identifier': 'deck-client',
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			}
		});
	}

	// PUT request
	async put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, {
			method: 'PUT',
			body: JSON.stringify(body),
		});
	}

	// DELETE request
	async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
		return this.request<T>(endpoint, { method: 'DELETE' });
	}

	// Voice command specific endpoint
	async sendVoiceCommand(text: string): Promise<ApiResponse<SpeakApiResponse>> {
		const payload: VoiceCommandPayload = {
			text,
			speaker: 107,
		};
		return this.post<SpeakApiResponse>('/api/speak', payload);
	}
}

// Singleton instance
export const api = new ApiService();

// Export types
export type { ApiResponse, VoiceCommandPayload, SpeakApiResponse };
