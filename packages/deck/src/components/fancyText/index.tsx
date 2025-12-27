import './index.css';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import Star from '../Star/index.tsx';
export default function FancyText({
	text,
	jap,
	showStar,
}: {
	text?: string;
	jap?: string;
	showStar?: boolean;
}) {
	return (
		<div className="namestarContainer">
			{showStar && (
				<>
					<div className="star1">
						<Star />
					</div>
					<div className="star2">
						<Star />
					</div>
					<div className="star3">
						<Star />
					</div>
					<div className="star4">
						<Star />
					</div>
					<div className="star5">
						<Star />
					</div>
					<div className="star6">
						<Star />
					</div>
				</>
			)}
			<div className="nameContainer">
				{jap && <div className="jap">{jap}</div>}
				<div className="main" title={text || 'Yumi'}>
					{text || 'Yumi'}
				</div>
				<div className="main-below" title={text || 'Yumi'}>
					{text || 'Yumi'}
				</div>
			</div>
		</div>
	);
}
