import { useState, useEffect } from 'react';
import { useYumiResponse } from '../../contexts/YumiResponseContext';
import './index.css';

export default function Transcript() {
	const { state } = useYumiResponse();
	const [visible, setVisible] = useState(false);
	const [fading, setFading] = useState(false);

	useEffect(() => {
		if (state.transcript) {
			setVisible(true);
			setFading(false);
		}
	}, [state.transcript]);

	useEffect(() => {
		// When audio stops playing, start fade out after a delay
		if (!state.isPlaying && visible) {
			const timer = setTimeout(() => {
				setFading(true);
				// Remove from DOM after animation
				setTimeout(() => {
					setVisible(false);
					setFading(false);
				}, 300);
			}, 5000); // Keep visible for 5 seconds after audio ends

			return () => clearTimeout(timer);
		}
	}, [state.isPlaying, visible]);

	if (!visible || !state.transcript) {
		return null;
	}

	return (
		<div className="transcript-container">
			<div className={`transcript-bubble ${fading ? 'fading' : ''}`}>
				<div className="transcript-text-en">{state.transcript}</div>
				{state.transcriptJp && (
					<div className="transcript-text-jp">{state.transcriptJp}</div>
				)}
			</div>
		</div>
	);
}
