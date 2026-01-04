// Artwork cache for media thumbnails
// Stores base64 artwork per device hash

interface ArtworkEntry {
	data: string;        // base64 data URL
	trackKey: string;    // title|artist to detect changes
	timestamp: number;   // when it was cached
}

class ArtworkCache {
	private cache = new Map<string, ArtworkEntry>();
	
	/**
	 * Update artwork cache for a device
	 * @returns URL to use for artwork, or null/undefined
	 */
	set(deviceHash: string, artwork: string | null | undefined, title?: string, artist?: string): string | null | undefined {
		const trackKey = `${title || ''}|${artist || ''}`;
		
		// null means clear artwork
		if (artwork === null) {
			this.cache.delete(deviceHash);
			return null;
		}
		
		// undefined means no change - return existing URL if cached
		if (artwork === undefined) {
			const existing = this.cache.get(deviceHash);
			if (existing && existing.trackKey === trackKey) {
				return `/api/artwork/${deviceHash}`;
			}
			return undefined;
		}
		
		// New artwork - cache it
		this.cache.set(deviceHash, {
			data: artwork,
			trackKey,
			timestamp: Date.now(),
		});
		
		// Return the URL that clients should use
		return `/api/artwork/${deviceHash}`;
	}
	
	/**
	 * Get cached artwork for a device
	 */
	get(deviceHash: string): string | null {
		const entry = this.cache.get(deviceHash);
		return entry?.data || null;
	}
	
	/**
	 * Check if device has cached artwork
	 */
	has(deviceHash: string): boolean {
		return this.cache.has(deviceHash);
	}
	
	/**
	 * Clear artwork for a device
	 */
	clear(deviceHash: string): void {
		this.cache.delete(deviceHash);
	}
	
	/**
	 * Clear all cached artwork
	 */
	clearAll(): void {
		this.cache.clear();
	}
}

export const artworkCache = new ArtworkCache();
