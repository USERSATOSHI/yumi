import { useState, useRef, useCallback, useEffect } from 'react';
import { useVoiceCommand } from '../../hooks/useApi';
import './index.css';

// Web Speech API type definitions
interface SpeechRecognitionEvent extends Event {
	results: SpeechRecognitionResultList;
	resultIndex: number;
}

interface SpeechRecognitionResultList {
	length: number;
	item(index: number): SpeechRecognitionResult;
	[index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
	length: number;
	item(index: number): SpeechRecognitionAlternative;
	[index: number]: SpeechRecognitionAlternative;
	isFinal: boolean;
}

interface SpeechRecognitionAlternative {
	transcript: string;
	confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
	error: string;
	message: string;
}

interface ISpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
	onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
	onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
	onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition;

interface IWindow extends Window {
	SpeechRecognition?: SpeechRecognitionConstructor;
	webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

export default function VoiceIndicator() {
	const [isListening, setIsListening] = useState(false);
	const recognitionRef = useRef<ISpeechRecognition | null>(null);
	const { sendVoiceCommand } = useVoiceCommand();

	// Initialize Speech Recognition
	useEffect(() => {
		const windowWithSpeech = window as IWindow;
		const SpeechRecognitionAPI =
			windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

		if (!SpeechRecognitionAPI) {
			console.error('Speech Recognition API not supported in this browser');
			return;
		}

		const recognition = new SpeechRecognitionAPI();
		recognition.continuous = false;
		recognition.interimResults = false;
		recognition.lang = 'en-US';

		recognition.onstart = () => {
			setIsListening(true);
		};

		recognition.onend = () => {
			setIsListening(false);
		};

		recognition.onresult = (event) => {
			const transcript = event.results[0][0].transcript;
			console.log('Transcribed:', transcript);
			sendVoiceCommand(transcript);
		};

		recognition.onerror = (event) => {
			console.error('Speech recognition error:', event.error);
			setIsListening(false);
		};

		recognitionRef.current = recognition;

		return () => {
			if (recognitionRef.current) {
				recognitionRef.current.abort();
			}
		};
	}, [sendVoiceCommand]);

	const toggleListening = useCallback(() => {
		if (!recognitionRef.current) {
			console.error('Speech Recognition not initialized');
			return;
		}

		if (isListening) {
			recognitionRef.current.stop();
		} else {
			try {
				recognitionRef.current.start();
			} catch (error) {
				console.error('Failed to start speech recognition:', error);
			}
		}
	}, [isListening]);

	return (
		<button
			className={`voice-indicator ${isListening ? 'listening' : ''}`}
			onClick={toggleListening}
			title={isListening ? 'Stop listening' : 'Start voice input'}
			aria-label={isListening ? 'Stop listening' : 'Start voice input'}
		>
			<div className="voice-indicator-shadow" />
			<div className="voice-indicator-box">
				<div className="voice-indicator-dot" />
			</div>
		</button>
	);
}
