/**
 * Natural language date/time parser for AI tool calls.
 *
 * Handles various input formats:
 * - Relative: "today", "tomorrow", "next week", "in 2 hours"
 * - Absolute time: "15:00", "3pm", "3:30 PM"
 * - Absolute date: "2026-02-15", "Feb 15", "February 15th"
 * - Combined: "tomorrow at 3pm", "next Monday at 10:00"
 * - Natural: "starting today", "from now", "beginning tomorrow"
 */

export interface ParsedDateTime {
	date: Date;
	hasTime: boolean; // Whether a specific time was provided
	hasDate: boolean; // Whether a specific date was provided
}

export interface ParsedRecurrence {
	type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
	interval: number; // e.g., every 2 weeks = { type: 'weekly', interval: 2 }
	daysOfWeek?: number[]; // 0-6 for weekly (0 = Sunday)
	dayOfMonth?: number; // 1-31 for monthly
	monthOfYear?: number; // 1-12 for yearly
	endDate?: Date; // Optional end date for recurrence
	occurrences?: number; // Optional max number of occurrences
}

// Day name mappings
const DAY_NAMES: Record<string, number> = {
	sunday: 0,
	sun: 0,
	monday: 1,
	mon: 1,
	tuesday: 2,
	tue: 2,
	tues: 2,
	wednesday: 3,
	wed: 3,
	thursday: 4,
	thu: 4,
	thur: 4,
	thurs: 4,
	friday: 5,
	fri: 5,
	saturday: 6,
	sat: 6,
};

// Month name mappings
const MONTH_NAMES: Record<string, number> = {
	january: 0,
	jan: 0,
	february: 1,
	feb: 1,
	march: 2,
	mar: 2,
	april: 3,
	apr: 3,
	may: 4,
	june: 5,
	jun: 5,
	july: 6,
	jul: 6,
	august: 7,
	aug: 7,
	september: 8,
	sep: 8,
	sept: 8,
	october: 9,
	oct: 9,
	november: 10,
	nov: 10,
	december: 11,
	dec: 11,
};

/**
 * Parse a time string into hours and minutes.
 *
 * @param timeStr - Time string like "15:00", "3pm", "3:30 PM"
 * @returns Tuple of [hours, minutes] or null if invalid
 */
export function parseTime(timeStr: string): [number, number] | null {
	const normalized = timeStr.toLowerCase().trim();

	// Try 24h format: "15:00", "9:30"
	const time24Match = normalized.match(/^(\d{1,2}):(\d{2})$/);
	if (time24Match) {
		const hours = parseInt(time24Match[1]!, 10);
		const minutes = parseInt(time24Match[2]!, 10);
		if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
			return [hours, minutes];
		}
	}

	// Try 12h format: "3pm", "3:30pm", "3 pm", "3:30 PM"
	const time12Match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
	if (time12Match) {
		let hours = parseInt(time12Match[1]!, 10);
		const minutes = time12Match[2] ? parseInt(time12Match[2], 10) : 0;
		const isPM = time12Match[3] === 'pm';

		if (hours < 1 || hours > 12 || minutes < 0 || minutes >= 60) {
			return null;
		}

		// Convert to 24h
		if (isPM && hours !== 12) {
			hours += 12;
		} else if (!isPM && hours === 12) {
			hours = 0;
		}

		return [hours, minutes];
	}

	// Try just hours: "15", "9"
	const hoursOnly = normalized.match(/^(\d{1,2})$/);
	if (hoursOnly) {
		const hours = parseInt(hoursOnly[1]!, 10);
		if (hours >= 0 && hours < 24) {
			return [hours, 0];
		}
	}

	return null;
}

/**
 * Parse a natural language date/time string.
 *
 * @param input - Natural language date/time like "today", "tomorrow at 3pm", "next Monday"
 * @param referenceDate - Reference date for relative calculations (defaults to now)
 * @returns ParsedDateTime or null if parsing fails
 */
export function parseDateTime(
	input: string,
	referenceDate: Date = new Date(),
	recurrence: ParsedRecurrence | null = null,
): ParsedDateTime | null {
	const normalized = input.toLowerCase().trim();
	const result = new Date(referenceDate);
	console.debug('[parser] parseDateTime called', { input: normalized, reference: referenceDate.toISOString(), recurrence });
	let hasTime = false;
	let hasDate = false;

	// Extract time component if present

    // Helper to check if a time is in the past (for today)
    function isPast(date: Date, ref: Date) {
        return date.getTime() <= ref.getTime();
    }
	const atTimeMatch = normalized.match(/(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})$/);
	let datePartOnly = normalized;
	if (atTimeMatch) {
		const timePart = atTimeMatch[1]!;
		const parsedTime = parseTime(timePart);
		if (parsedTime) {
			result.setHours(parsedTime[0], parsedTime[1], 0, 0);
			hasTime = true;
			datePartOnly = normalized.replace(atTimeMatch[0], '').trim();
			console.debug('[parser] extracted time', { timePart, hours: parsedTime[0], minutes: parsedTime[1], datePartOnly });
		}
	}

	// Handle empty date part (just time)
	if (!datePartOnly || datePartOnly === 'at') {
		// Just time, use today
		if (hasTime) {
			// If time already passed today, use tomorrow
			if (result.getTime() <= referenceDate.getTime()) {
				result.setDate(result.getDate() + 1);
			}
			return { date: result, hasTime, hasDate: false };
		}
		return null;
	}

	// Handle relative dates
	if (
		datePartOnly === 'today' ||
		datePartOnly === 'now' ||
		datePartOnly === 'starting today' ||
		datePartOnly === 'from now' ||
		datePartOnly === 'from today'
	) {
		hasDate = true;
		if (!hasTime) {
			// Default to current time for "now", or a reasonable default
			if (datePartOnly === 'now' || datePartOnly === 'from now') {
				// Keep current time
				hasTime = true;
			} else {
				// Default to 9 AM for "today"
				result.setHours(9, 0, 0, 0);
			}
        }
		// If time is in the past for today, advance to the next valid occurrence.
		if (isPast(result, referenceDate)) {
			console.debug('[parser] time for today is in the past', { result: result.toISOString(), reference: referenceDate.toISOString(), recurrence });
			if (recurrence) {
				// Use recurrence rules to find the next occurrence after referenceDate
				let attempts = 0;
				while (isPast(result, referenceDate) && attempts < 100) {
					const next = getNextOccurrence(result, recurrence);
					if (next.getTime() === result.getTime()) break;
					console.debug('[parser] advancing to next occurrence', { from: result.toISOString(), to: next.toISOString() });
					result.setTime(next.getTime());
					attempts++;
				}
				if (isPast(result, referenceDate)) {
					result.setDate(result.getDate() + 1);
				}
			} else {
				// No recurrence info: default to next day
				result.setDate(result.getDate() + 1);
			}
			console.debug('[parser] adjusted result after past-detection', { result: result.toISOString() });
		}
	} else if (
		datePartOnly === 'tomorrow' ||
		datePartOnly === 'starting tomorrow' ||
		datePartOnly === 'from tomorrow'
	) {
		result.setDate(result.getDate() + 1);
		hasDate = true;
		if (!hasTime) {
			result.setHours(9, 0, 0, 0);
		}
	} else if (datePartOnly === 'day after tomorrow') {
		result.setDate(result.getDate() + 2);
		hasDate = true;
		if (!hasTime) {
			result.setHours(9, 0, 0, 0);
		}
	} else {
		// Try "next <day>" pattern
		const nextDayMatch = datePartOnly.match(/^next\s+(\w+)$/);
		if (nextDayMatch) {
			const dayName = nextDayMatch[1]!.toLowerCase();
			const targetDay = DAY_NAMES[dayName];
			if (targetDay !== undefined) {
				const currentDay = result.getDay();
				let daysUntil = targetDay - currentDay;
				if (daysUntil <= 0) {
					daysUntil += 7;
				}
				result.setDate(result.getDate() + daysUntil);
				hasDate = true;
				if (!hasTime) {
					result.setHours(9, 0, 0, 0);
				}
			} else if (dayName === 'week') {
				result.setDate(result.getDate() + 7);
				hasDate = true;
				if (!hasTime) {
					result.setHours(9, 0, 0, 0);
				}
			} else if (dayName === 'month') {
				result.setMonth(result.getMonth() + 1);
				hasDate = true;
				if (!hasTime) {
					result.setHours(9, 0, 0, 0);
				}
			}
		}

		// Try "in X <unit>" pattern
		const inDurationMatch = datePartOnly.match(/^in\s+(\d+)\s+(minute|hour|day|week|month|year)s?$/);
		if (inDurationMatch) {
			const amount = parseInt(inDurationMatch[1]!, 10);
			const unit = inDurationMatch[2]!;

			switch (unit) {
				case 'minute':
					result.setMinutes(result.getMinutes() + amount);
					hasTime = true;
					break;
				case 'hour':
					result.setHours(result.getHours() + amount);
					hasTime = true;
					break;
				case 'day':
					result.setDate(result.getDate() + amount);
					hasDate = true;
					break;
				case 'week':
					result.setDate(result.getDate() + amount * 7);
					hasDate = true;
					break;
				case 'month':
					result.setMonth(result.getMonth() + amount);
					hasDate = true;
					break;
				case 'year':
					result.setFullYear(result.getFullYear() + amount);
					hasDate = true;
					break;
			}

			if (!hasTime && !['minute', 'hour'].includes(unit)) {
				result.setHours(9, 0, 0, 0);
			}
		}

		// Try ISO date format: "2026-02-15"
		const isoMatch = datePartOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (isoMatch) {
			result.setFullYear(
				parseInt(isoMatch[1]!, 10),
				parseInt(isoMatch[2]!, 10) - 1,
				parseInt(isoMatch[3]!, 10),
			);
			hasDate = true;
			if (!hasTime) {
				result.setHours(9, 0, 0, 0);
			}
		}

		// Try "Month Day" format: "Feb 15", "February 15th"
		const monthDayMatch = datePartOnly.match(
			/^(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/,
		);
		if (monthDayMatch) {
			const monthName = monthDayMatch[1]!.toLowerCase();
			const day = parseInt(monthDayMatch[2]!, 10);
			const year = monthDayMatch[3] ? parseInt(monthDayMatch[3], 10) : result.getFullYear();
			const month = MONTH_NAMES[monthName];

			if (month !== undefined && day >= 1 && day <= 31) {
				result.setFullYear(year, month, day);
				hasDate = true;
				if (!hasTime) {
					result.setHours(9, 0, 0, 0);
				}
			}
		}

		// Try just day name: "Monday", "Friday"
		const dayName = datePartOnly.toLowerCase();
		const targetDay = DAY_NAMES[dayName];
		if (targetDay !== undefined) {
			const currentDay = result.getDay();
			let daysUntil = targetDay - currentDay;
			if (daysUntil <= 0) {
				daysUntil += 7;
			}
			result.setDate(result.getDate() + daysUntil);
			hasDate = true;
			if (!hasTime) {
				result.setHours(9, 0, 0, 0);
			}
		}
	}

	// Only return if we parsed something
	if (hasDate || hasTime) {
		console.debug('[parser] parseDateTime result', { date: result.toISOString(), hasTime, hasDate });
		return { date: result, hasTime, hasDate };
	}

	return null;
}

/**
 * Parse a recurrence pattern from natural language.
 *
 * Handles:
 * - "daily", "every day"
 * - "weekly", "every week", "every Monday", "every Mon and Wed"
 * - "monthly", "every month", "every 1st", "every 15th"
 * - "yearly", "every year", "annually"
 * - "every 2 weeks", "every 3 months"
 *
 * @param input - Natural language recurrence pattern
 * @returns ParsedRecurrence or null if not a recurrence
 */
export function parseRecurrence(input: string): ParsedRecurrence | null {
	const normalized = input.toLowerCase().trim();
	console.debug('[parser] parseRecurrence called', { input: normalized });

	// Daily patterns
	if (normalized === 'daily' || normalized === 'every day' || normalized === 'everyday') {
		return { type: 'daily', interval: 1 };
	}

	// Weekly patterns
	if (normalized === 'weekly' || normalized === 'every week') {
		return { type: 'weekly', interval: 1 };
	}

	// Monthly patterns
	if (normalized === 'monthly' || normalized === 'every month') {
		return { type: 'monthly', interval: 1 };
	}

	// Yearly patterns
	if (
		normalized === 'yearly' ||
		normalized === 'annually' ||
		normalized === 'every year'
	) {
		return { type: 'yearly', interval: 1 };
	}

	// "every N <unit>" patterns
	const everyNMatch = normalized.match(
		/^every\s+(\d+)\s+(day|week|month|year)s?$/,
	);
	if (everyNMatch) {
		const interval = parseInt(everyNMatch[1]!, 10);
		const unit = everyNMatch[2]!;

		const typeMap: Record<string, ParsedRecurrence['type']> = {
			day: 'daily',
			week: 'weekly',
			month: 'monthly',
			year: 'yearly',
		};

		return { type: typeMap[unit]!, interval };
	}

	// "every <day>" patterns (e.g., "every Monday", "every Mon")
	const everyDayMatch = normalized.match(/^every\s+(\w+)$/);
	if (everyDayMatch) {
		const dayName = everyDayMatch[1]!.toLowerCase();
		const dayNum = DAY_NAMES[dayName];
		if (dayNum !== undefined) {
			return { type: 'weekly', interval: 1, daysOfWeek: [dayNum] };
		}
	}

	// "every <day> and <day>" patterns
	const everyDaysMatch = normalized.match(
		/^every\s+(\w+)(?:\s+and\s+(\w+))?(?:\s+and\s+(\w+))?$/,
	);
	if (everyDaysMatch) {
		const days: number[] = [];
		for (let i = 1; i <= 3; i++) {
			const dayName = everyDaysMatch[i];
			if (dayName) {
				const dayNum = DAY_NAMES[dayName.toLowerCase()];
				if (dayNum !== undefined) {
					days.push(dayNum);
				}
			}
		}
		if (days.length > 0) {
			return { type: 'weekly', interval: 1, daysOfWeek: days };
		}
	}

	// "every <ordinal>" patterns (e.g., "every 1st", "every 15th")
	const everyOrdinalMatch = normalized.match(/^every\s+(\d+)(?:st|nd|rd|th)?$/);
	if (everyOrdinalMatch) {
		const dayOfMonth = parseInt(everyOrdinalMatch[1]!, 10);
		if (dayOfMonth >= 1 && dayOfMonth <= 31) {
			return { type: 'monthly', interval: 1, dayOfMonth };
		}
	}

	console.debug('[parser] parseRecurrence no match', { input: normalized });
	return null;
}

/**
 * Convert a simple repeat string to ParsedRecurrence.
 *
 * @param repeat - Simple repeat string like 'daily', 'weekly', 'monthly', 'yearly'
 * @returns ParsedRecurrence
 */
export function simpleRepeatToRecurrence(
	repeat: 'daily' | 'weekly' | 'monthly' | 'yearly',
): ParsedRecurrence {
	return { type: repeat, interval: 1 };
}

/**
 * Calculate the next occurrence date based on recurrence pattern.
 *
 * @param currentDate - Current occurrence date
 * @param recurrence - Recurrence pattern
 * @returns Next occurrence date
 */
export function getNextOccurrence(currentDate: Date, recurrence: ParsedRecurrence): Date {
	console.debug('[parser] getNextOccurrence called', { current: currentDate.toISOString(), recurrence });
	const next = new Date(currentDate);

	switch (recurrence.type) {
		case 'daily':
			next.setDate(next.getDate() + recurrence.interval);
			break;

		case 'weekly':
			if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
				// Find next matching day of week
				const currentDay = next.getDay();
				const sortedDays = [...recurrence.daysOfWeek].sort((a, b) => a - b);

				// Find next day after current
				let nextDay = sortedDays.find((d) => d > currentDay);
				if (nextDay === undefined) {
					// Wrap to next week
					nextDay = sortedDays[0]!;
					next.setDate(next.getDate() + (7 * recurrence.interval - currentDay + nextDay));
				} else {
					next.setDate(next.getDate() + (nextDay - currentDay));
				}
			} else {
				next.setDate(next.getDate() + 7 * recurrence.interval);
			}
			break;

		case 'monthly':
			if (recurrence.dayOfMonth) {
				next.setMonth(next.getMonth() + recurrence.interval);
				// Handle months with fewer days
				const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
				next.setDate(Math.min(recurrence.dayOfMonth, daysInMonth));
			} else {
				next.setMonth(next.getMonth() + recurrence.interval);
			}
			break;

		case 'yearly':
			next.setFullYear(next.getFullYear() + recurrence.interval);
			break;

		case 'custom':
			// For custom, assume daily with interval
			next.setDate(next.getDate() + recurrence.interval);
			break;
	}

	console.debug('[parser] getNextOccurrence result', { next: next.toISOString() });
	return next;
}

/**
 * Format a recurrence pattern for display.
 *
 * @param recurrence - Recurrence pattern
 * @returns Human-readable string
 */
export function formatRecurrence(recurrence: ParsedRecurrence): string {
	const { type, interval, daysOfWeek, dayOfMonth } = recurrence;

	if (interval === 1) {
		switch (type) {
			case 'daily':
				return 'daily';
			case 'weekly':
				if (daysOfWeek && daysOfWeek.length > 0) {
					const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
					const days = daysOfWeek.map((d) => dayNames[d]).join(', ');
					return `weekly on ${days}`;
				}
				return 'weekly';
			case 'monthly':
				if (dayOfMonth) {
					return `monthly on the ${ordinal(dayOfMonth)}`;
				}
				return 'monthly';
			case 'yearly':
				return 'yearly';
			default:
				return 'custom';
		}
	}

	switch (type) {
		case 'daily':
			return `every ${interval} days`;
		case 'weekly':
			return `every ${interval} weeks`;
		case 'monthly':
			return `every ${interval} months`;
		case 'yearly':
			return `every ${interval} years`;
		default:
			return `every ${interval} days`;
	}
}

function ordinal(n: number): string {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return n + (s[(v - 20) % 10] || s[v] || s[0])!;
}
