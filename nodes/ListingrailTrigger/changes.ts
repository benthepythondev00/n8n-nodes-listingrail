import type { IDataObject } from 'n8n-workflow';

export type Event = 'newListing' | 'priceDrop';

/**
 * The items one monitor check yields for an event.
 * newListing: every listing in `changes.new` (full listings).
 * priceDrop: rows of `changes.price_changed` whose new price is a number below the old one
 *   (the API's price_changed also has rises; those are left out).
 * Each item carries the monitor's id, source, location and the check time.
 */
export function itemsFor(monitor: IDataObject, changes: IDataObject, event: Event): IDataObject[] {
	const base = {
		monitor_id: monitor.id,
		monitor_source: monitor.source,
		monitor_location: monitor.location,
		checked_at: changes.checked_at,
	};
	if (event === 'newListing') {
		return ((changes.new as IDataObject[]) || []).map((l) => ({ event: 'new_listing', ...base, ...l }));
	}
	const out: IDataObject[] = [];
	for (const row of (changes.price_changed as IDataObject[]) || []) {
		const oldP = row.old_price;
		const newP = row.new_price;
		if (typeof oldP !== 'number' || typeof newP !== 'number' || !(newP < oldP)) continue;
		out.push({
			event: 'price_drop',
			...base,
			...row,
			drop_amount: oldP - newP,
			drop_percent: oldP > 0 ? Math.round(((oldP - newP) / oldP) * 1000) / 10 : null,
		});
	}
	return out;
}

/**
 * Whether a poll should emit this check: not a check already emitted, and not the first check of a
 * monitor (it lists every listing as new) unless asked. A manual test run always shows the last check.
 */
export function shouldEmit(
	changes: IDataObject,
	lastEmitted: string | undefined,
	includeFirstCheck: boolean,
	manual: boolean,
): boolean {
	const checkedAt = changes.checked_at as string | undefined;
	if (!checkedAt) return false;
	if (manual) return true;
	if (checkedAt === lastEmitted) return false;
	if (changes.first_check && !includeFirstCheck) return false;
	return true;
}
