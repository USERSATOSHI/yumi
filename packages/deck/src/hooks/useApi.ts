import { useState, useCallback } from 'react';
import { api, type ApiResponse, type SpeakApiResponse } from '../api';
import type { StatsResponse } from '../types/stats';
import { useYumiResponse } from '../contexts/YumiResponseContext';

// Generic hook for API calls with loading and error states
export function useApi() {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const execute = useCallback(async <T>(
		apiCall: () => Promise<ApiResponse<T>>
	): Promise<ApiResponse<T>> => {
		setLoading(true);
		setError(null);

		const result = await apiCall();

		if (!result.success) {
			setError(result.error || 'Unknown error');
		}

		setLoading(false);
		return result;
	}, []);

	return { loading, error, execute };
}

// Voice command hook
export function useVoiceCommand() {
	const { loading, error, execute } = useApi();
	const { handleSpeakResponse } = useYumiResponse();

	const sendVoiceCommand = useCallback(async (text: string) => {
		const result = await execute<SpeakApiResponse>(() => api.sendVoiceCommand(text));
		
		// If successful, handle the response (play audio + show transcript)
		if (result.success && result.data) {
			handleSpeakResponse(result.data);
		}
		
		return result;
	}, [execute, handleSpeakResponse]);

	return { loading, error, sendVoiceCommand };
}

// Generic GET hook
export function useGet<T>() {
	const { loading, error, execute } = useApi();

	const get = useCallback(async (endpoint: string) => {
		return execute<T>(() => api.get<T>(endpoint));
	}, [execute]);

	return { loading, error, get };
}

// Generic POST hook
export function usePost<T>() {
	const { loading, error, execute } = useApi();

	const post = useCallback(async (endpoint: string, body: unknown) => {
		return execute<T>(() => api.post<T>(endpoint, body));
	}, [execute]);

	return { loading, error, post };
}

// Stats hook
export function useStats() {
	const { loading, error, execute } = useApi();
	const [stats, setStats] = useState<StatsResponse | null>(null);

	const fetchStats = useCallback(async () => {
		const result = await execute<StatsResponse>(() => api.get<StatsResponse>('/api/stats'));
		if (result.success && result.data) {
			setStats(result.data);
		}
		return result;
	}, [execute]);

	return { loading, error, stats, fetchStats };
}
