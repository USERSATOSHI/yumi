import Elysia from 'elysia';
import { artworkCache } from '../ws/artwork.js';

export const artwork = new Elysia({
	prefix: '/artwork',
})
	.get('/:deviceHash', ({ params, set }) => {
		const { deviceHash } = params;
		const data = artworkCache.get(deviceHash);
		
		if (!data) {
			set.status = 404;
			return { error: 'Artwork not found' };
		}
		
		// Parse data URL: data:image/png;base64,<data>
		const match = data.match(/^data:([^;]+);base64,(.+)$/);
		if (!match) {
			set.status = 500;
			return { error: 'Invalid artwork format' };
		}
		
		const [, contentType, base64Data] = match;
		const buffer = Buffer.from(base64Data!, 'base64');
		
		set.headers['Content-Type'] = contentType!;
		set.headers['Cache-Control'] = 'public, max-age=60'; // Cache for 1 minute
		
		return new Response(buffer, {
			headers: {
				'Content-Type': contentType!,
				'Cache-Control': 'public, max-age=60',
			}
		});
	});
