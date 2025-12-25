import { Elysia } from 'elysia';

import { Speak } from './service';
import { SpeakModel } from './model';

const speak = new Elysia({ prefix: '/speak' }).post(
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
);

export default speak;
