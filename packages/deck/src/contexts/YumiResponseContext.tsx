import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { SpeakApiResponse } from '../api';

interface YumiResponseState {
	transcript: string | null;
	transcriptJp: string | null;
	isPlaying: boolean;
}

interface YumiResponseContextType {
	state: YumiResponseState;
	handleSpeakResponse: (response: SpeakApiResponse) => void;
	clearTranscript: () => void;
}

const defaultState: YumiResponseState = {
	transcript: null,
	transcriptJp: null,
	isPlaying: false,
};

const YumiResponseContext = createContext<YumiResponseContextType | null>(null);

export function YumiResponseProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<YumiResponseState>(defaultState);

	const handleSpeakResponse = useCallback((response: SpeakApiResponse) => {
		console.log('handleSpeakResponse called with:', response);
		
		// Set the transcript
		setState({
			transcript: response.en,
			transcriptJp: response.jp,
			isPlaying: true,
		});

		// Get the audio element and play the audio
		const audioEl = document.getElementById('yumi-audio') as HTMLAudioElement | null;
		console.log('Audio element found:', audioEl);
		
		if (audioEl && response.audio) {
			console.log('Setting audio src to:', response.audio);
			
			// Remove old event listeners
			audioEl.oncanplaythrough = null;
			audioEl.onended = null;
			audioEl.onerror = null;
			
			// Reset the audio element
			audioEl.pause();
			audioEl.currentTime = 0;
			audioEl.src = response.audio;
			audioEl.loop = false;
			
			// Error handler
			audioEl.onerror = (e) => {
				console.error('Audio error:', e, audioEl.error);
				setState((prev) => ({ ...prev, isPlaying: false }));
			};

			// Clear transcript when audio ends
			audioEl.onended = () => {
				console.log('Audio ended');
				setState((prev) => ({
					...prev,
					isPlaying: false,
				}));
			};
			
			// Resume any suspended AudioContext (needed for Web Audio API / lip sync)
			// @ts-ignore - accessing potential AudioContext on window
			if (window.AudioContext || window.webkitAudioContext) {
				const resumeContext = () => {
					// Find and resume any audio contexts
					const audioContexts = document.querySelectorAll('audio');
					audioContexts.forEach(() => {
						// The lip sync creates an AudioContext that may be suspended
					});
				};
				resumeContext();
			}
			
			// Play the audio
			audioEl.load();
			audioEl.play()
				.then(() => console.log('Audio playing'))
				.catch((e) => {
					console.warn('Audio play blocked:', e);
					// Try to play on user interaction
					const playOnClick = () => {
						audioEl.play().catch(console.warn);
						document.removeEventListener('click', playOnClick);
					};
					document.addEventListener('click', playOnClick, { once: true });
				});
		} else {
			console.warn('No audio element or audio URL', { audioEl, audioUrl: response.audio });
		}
	}, []);

	const clearTranscript = useCallback(() => {
		setState(defaultState);
	}, []);

	return (
		<YumiResponseContext.Provider value={{ state, handleSpeakResponse, clearTranscript }}>
			{children}
		</YumiResponseContext.Provider>
	);
}

export function useYumiResponse() {
	const context = useContext(YumiResponseContext);
	if (!context) {
		throw new Error('useYumiResponse must be used within a YumiResponseProvider');
	}
	return context;
}
