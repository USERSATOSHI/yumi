import { ErrorBase } from "@yumi/results";

type Kinds = 'FailedAudioQuery' | 'InvalidSpeaker' | 'ServerError' | 'NetworkError' | 'InvalidResponse' | 'SynthesisError' |
	'UnsupportedFeature' | 'ServerUnavailable';

export class VoiceVoxError extends ErrorBase<Kinds> {
	static FailedAudioQuery(message: string) {
		return new VoiceVoxError(`Failed to get audio query: ${message}`, 'FailedAudioQuery');
	}

	static InvalidSpeaker(speakerId: number) {
		return new VoiceVoxError(`Invalid speaker ID: ${speakerId}`, 'InvalidSpeaker');
	}

	static readonly ServerError = new VoiceVoxError('Internal server error', 'ServerError');
	
	static NetworkError(message: string) {
		return new VoiceVoxError(`Network error: ${message}`, 'NetworkError');
	}

	static InvalidResponse(message: string) {
		return new VoiceVoxError(`Invalid response: ${message}`, 'InvalidResponse');
	}

	static SynthesisError(message: string) {
		return new VoiceVoxError(`Synthesis error: ${message}`, 'SynthesisError');
	}

	static UnsupportedFeature(feature: string) {
		return new VoiceVoxError(`Unsupported feature: ${feature}`, 'UnsupportedFeature');
	}

	static readonly ServerUnavailable = new VoiceVoxError('VoiceVox server is unavailable', 'ServerUnavailable');
}