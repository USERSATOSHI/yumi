import { Elysia } from 'elysia';

import { Speak } from './service';
import { SpeakModel } from './model';
import { join } from 'node:path';

const dataDir = process.env.YUMI_DATA_DIR ?? join(process.cwd(), '.yumi');

const speak = new Elysia({ prefix: '/speak' })
	.post(
		'/',
		async ({ body, request }) => {
			const identifier = request.headers.get('x-identifier') || '';
			return Speak.generate({ ...body, identifier }, request);
		},
		{
			body: SpeakModel.body,
			response: {
				200: SpeakModel.responseOk,
				400: SpeakModel.responseError,
				500: SpeakModel.responseError,
			},
		},
	)
	.get('/audio', async () => {
		const audioFile = await Bun.file(join(dataDir, 'audio.wav')).arrayBuffer();
		return new Response(audioFile, {
			headers: {
				'Content-Type': 'audio/wav',
				'Content-Length': audioFile.byteLength.toString(),
				'Cache-Control': 'no-cache',
			},
		});
	})
	.get('/reminder-audio', async () => {
		const audioFile = await Bun.file(join(dataDir, 'reminder-audio.wav')).arrayBuffer();
		return new Response(audioFile, {
			headers: {
				'Content-Type': 'audio/wav',
				'Content-Length': audioFile.byteLength.toString(),
				'Cache-Control': 'no-cache',
			},
		});
	});

export default speak;
