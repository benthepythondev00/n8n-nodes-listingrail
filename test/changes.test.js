// Runs on the build: npm test (builds first).
const test = require('node:test');
const assert = require('node:assert');
const { itemsFor, shouldEmit } = require('../dist/nodes/ListingrailTrigger/changes.js');

const monitor = { id: 7, source: 'rightmove', location: 'Manchester' };
const changes = {
	checked_at: '2026-11-20T06:20:11',
	first_check: false,
	new: [{ id: 'a1', url: 'https://x/a1', price: 1200, currency: 'GBP', beds: 2 }],
	price_changed: [
		{ id: 'b1', url: 'https://x/b1', price: 900, old_price: 1000, new_price: 900 },
		{ id: 'b2', url: 'https://x/b2', price: 1100, old_price: 1000, new_price: 1100 },
		{ id: 'b3', url: 'https://x/b3', price: null, old_price: 1000, new_price: null },
	],
	removed: [{ id: 'c1' }],
};

test('new listings carry the monitor and the check time', () => {
	const items = itemsFor(monitor, changes, 'newListing');
	assert.strictEqual(items.length, 1);
	assert.strictEqual(items[0].id, 'a1');
	assert.strictEqual(items[0].event, 'new_listing');
	assert.strictEqual(items[0].monitor_id, 7);
	assert.strictEqual(items[0].monitor_source, 'rightmove');
	assert.strictEqual(items[0].checked_at, '2026-11-20T06:20:11');
});

test('price drops only: rises and unknown prices are left out', () => {
	const items = itemsFor(monitor, changes, 'priceDrop');
	assert.deepStrictEqual(items.map((i) => i.id), ['b1']);
	assert.strictEqual(items[0].drop_amount, 100);
	assert.strictEqual(items[0].drop_percent, 10);
	assert.strictEqual(items[0].event, 'price_drop');
});

test('empty or missing lists give no items', () => {
	assert.deepStrictEqual(itemsFor(monitor, { checked_at: 'x' }, 'newListing'), []);
	assert.deepStrictEqual(itemsFor(monitor, { checked_at: 'x' }, 'priceDrop'), []);
});

test('a check is emitted once', () => {
	assert.strictEqual(shouldEmit(changes, undefined, false, false), true);
	assert.strictEqual(shouldEmit(changes, changes.checked_at, false, false), false);
	assert.strictEqual(shouldEmit(changes, '2026-11-19T06:20:00', false, false), true);
});

test('a monitor not checked yet emits nothing', () => {
	assert.strictEqual(shouldEmit({ note: 'Not checked yet.' }, undefined, false, false), false);
	assert.strictEqual(shouldEmit({}, undefined, false, true), false);
});

test('the first check is skipped unless asked, a manual run always shows the last check', () => {
	const first = { ...changes, first_check: true };
	assert.strictEqual(shouldEmit(first, undefined, false, false), false);
	assert.strictEqual(shouldEmit(first, undefined, true, false), true);
	assert.strictEqual(shouldEmit(first, undefined, false, true), true);
	assert.strictEqual(shouldEmit(changes, changes.checked_at, false, true), true);
});
