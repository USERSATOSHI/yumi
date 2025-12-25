import { t } from 'elysia';

export namespace SpeakModel {
	export const body = t.Object({
		text: t.String(),
		speaker: t.Number(),
	});

	export type Body = typeof body.static;

	export const responseOk = t.Object({
		jp: t.String(),
		en: t.String(),
		audio: t.String(),
	});

	export const responseError = t.Object({
		error: t.String(),
	});

	export type ResponseOk = typeof responseOk.static;
	export type ResponseError = typeof responseError.static;
}