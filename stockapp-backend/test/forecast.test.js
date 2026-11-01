const { test } = require('node:test');
const assert = require('node:assert/strict');
const { forecastItem, weeklyDemand } = require('../utils/forecast');

const NOW = new Date('2026-11-01T12:00:00Z');
const weeksAgo = (n) => new Date(NOW.getTime() - (n * 7 + 1) * 86400000);
const steady = (perWeek, count) => Array.from({ length: count }, (_, i) => ({ date: weeksAgo(i), quantity: perWeek }));
const item = (sales, stock, extra = {}) => forecastItem({ sales, stock, piecesPerCase: 10, costPrice: 50, ...extra }, { leadDays: 7, coverDays: 14, serviceLevel: 95 }, NOW);

test('weeks are bucketed oldest first, including weeks with no sales', () => {
  assert.deepEqual(weeklyDemand([{ date: weeksAgo(2), quantity: 5 }, { date: weeksAgo(0), quantity: 3 }], NOW), [5, 0, 3]);
});

test('steady sales forecast that same rate, with no extra safety stock', () => {
  const result = item(steady(70, 12), 0);
  assert.equal(result.perWeek, 70);
  assert.equal(result.safetyStock, 0);
  assert.equal(result.reorderPoint, 70);
  assert.equal(result.target, 210);
  assert.equal(result.confidence, 'good');
});

test('an order is rounded up to whole cases', () => {
  const result = item(steady(70, 12), 5);
  assert.equal(result.orderCases, 21);
  assert.equal(result.orderPieces, 210);
  assert.equal(result.estimatedCost, 10500);
  assert.equal(result.status, 'urgent');
});

test('enough stock means nothing to order', () => {
  const result = item(steady(70, 12), 500);
  assert.deepEqual([result.orderPieces, result.status, result.daysLeft], [0, 'ok', 50]);
});

test('an item under its reorder point with days left is order soon, not urgent', () => {
  const uneven = Array.from({ length: 12 }, (_, i) => ({ date: weeksAgo(i), quantity: i % 2 ? 20 : 120 }));
  const settings = { leadDays: 3, coverDays: 14 };
  const { reorderPoint } = forecastItem({ sales: uneven, stock: 0, piecesPerCase: 10 }, settings, NOW);
  const result = forecastItem({ sales: uneven, stock: reorderPoint, piecesPerCase: 10 }, settings, NOW);
  assert.equal(result.status, 'order');
  assert.ok(result.daysLeft > 3);
});

test('uneven sales need more safety stock than steady sales', () => {
  const uneven = Array.from({ length: 12 }, (_, i) => ({ date: weeksAgo(i), quantity: i % 2 ? 20 : 120 }));
  assert.ok(item(uneven, 0).safetyStock > 50);
});

test('recent weeks count more than old ones', () => {
  const rising = Array.from({ length: 12 }, (_, i) => ({ date: weeksAgo(i), quantity: i < 4 ? 100 : 10 }));
  const falling = Array.from({ length: 12 }, (_, i) => ({ date: weeksAgo(i), quantity: i < 4 ? 10 : 100 }));
  assert.ok(item(rising, 0).perWeek > 60);
  assert.ok(item(falling, 0).perWeek < 50);
});

test('a higher service level holds more stock', () => {
  const uneven = Array.from({ length: 12 }, (_, i) => ({ date: weeksAgo(i), quantity: i % 2 ? 20 : 120 }));
  const at = (serviceLevel) => forecastItem({ sales: uneven, stock: 0, piecesPerCase: 10 }, { serviceLevel }, NOW).safetyStock;
  assert.ok(at(98) > at(90));
});

test('one bill is only a rough guess', () => {
  const result = item([{ date: weeksAgo(0), quantity: 6 }], 0);
  assert.equal(result.confidence, 'rough');
  assert.equal(result.weeksOfHistory, 1);
});

test('an item never sold has no forecast and is not ordered', () => {
  const result = item([], 0);
  assert.deepEqual([result.status, result.confidence, result.orderPieces], ['no-sales', 'none', 0]);
});
