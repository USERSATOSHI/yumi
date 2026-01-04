import FancyText from '../../components/fancyText/index.tsx';
import VoiceIndicator from '../../components/VoiceIndicator/index.tsx';
import StatsMenu from '../../components/StatsMenu/index.tsx';
import './index.css';
import { useEffect, useState } from 'react';

const timeToHHMM = (date: Date) => {
	let hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
	const AMPM = Number(hours) >= 12 ? 'PM' : 'AM';
	hours = ((Number(hours) + 11) % 12 + 1).toString().padStart(2, '0');
	return `${hours}:${minutes} ${AMPM}`;
};

export default function Home() {
	const [time, setTime] = useState(new Date());

	useEffect(() => {
		const timer = setInterval(() => {
			setTime(new Date());
		}, 1000);

		return () => clearInterval(timer);
	}, []);

	return (
		<main className="home">
			{/* Clock with Voice Indicator and Stats Menu */}
			<div className="row clock-row">
				<VoiceIndicator />
				<FancyText text={timeToHHMM(time)} />
				<StatsMenu />
			</div>
			{/* Yumi */}
			<FancyText text="Yumi" showStar={true} />
		</main>
	);
}
