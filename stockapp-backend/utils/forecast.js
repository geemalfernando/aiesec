// utils/forecast.js
// How much of each item to order: a demand forecast, then safety stock, reorder point and order quantity.
const SERVICE_Z = { 90: 1.28, 95: 1.645, 98: 2.05 };
const SMOOTHING = 0.3;
const WEEK_MS = 7 * 86400000;
const MAX_WEEKS = 26;
const MIN_WEEKS_FOR_TRUST = 8;
const MIN_WEEKS_WITH_SALES = 4;

// Pieces sold in each whole week counting back from today, oldest first.
const weeklyDemand = (sales, now) => {
  if (sales.length === 0) return [];
  const first = Math.min(...sales.map((sale) => new Date(sale.date).getTime()));
  const weeks = Math.min(MAX_WEEKS, Math.max(1, Math.ceil((now.getTime() - first) / WEEK_MS)));
  const buckets = new Array(weeks).fill(0);
  sales.forEach((sale) => {
    const age = Math.floor((now.getTime() - new Date(sale.date).getTime()) / WEEK_MS);
    if (age >= 0 && age < weeks) buckets[weeks - 1 - age] += sale.quantity;
  });
  return buckets;
};

// Exponential smoothing: recent weeks count most. Returns the next week's forecast and its typical error.
const forecastWeek = (weeks) => {
  let level = weeks[0];
  const errors = [];
  weeks.slice(1).forEach((value) => {
    errors.push(value - level);
    level = SMOOTHING * value + (1 - SMOOTHING) * level;
  });
  if (errors.length < 3) return { perWeek: level, spread: Math.sqrt(Math.max(level, 1)) };
  const spread = Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length);
  return { perWeek: level, spread };
};

const forecastItem = ({ sales, stock, piecesPerCase, costPrice, price }, { leadDays = 7, coverDays = 14, serviceLevel = 95 } = {}, now = new Date()) => {
  const weeks = weeklyDemand(sales, now);
  if (weeks.length === 0) {
    return { confidence: 'none', status: 'no-sales', perWeek: 0, daysLeft: null, safetyStock: 0, reorderPoint: 0, target: 0, orderPieces: 0, orderCases: 0, estimatedCost: 0, weeksOfHistory: 0, weeks };
  }
  const { perWeek, spread } = forecastWeek(weeks);
  const perDay = perWeek / 7;
  const z = SERVICE_Z[serviceLevel] || SERVICE_Z[95];
  const safetyStock = Math.ceil(z * spread * Math.sqrt((leadDays + coverDays) / 7));
  const reorderPoint = Math.ceil(perDay * leadDays + safetyStock);
  const target = Math.ceil(perDay * (leadDays + coverDays) + safetyStock);
  const needed = stock <= reorderPoint ? Math.max(0, target - stock) : 0;
  // Companies sell in whole cases, so round up.
  const orderCases = Math.ceil(needed / piecesPerCase);
  const orderPieces = orderCases * piecesPerCase;
  const daysLeft = perDay > 0 ? Math.floor(stock / perDay) : null;
  const weeksWithSales = weeks.filter((value) => value > 0).length;
  let status = 'ok';
  if (orderPieces > 0) status = daysLeft !== null && daysLeft <= leadDays ? 'urgent' : 'order';
  return {
    confidence: weeks.length >= MIN_WEEKS_FOR_TRUST && weeksWithSales >= MIN_WEEKS_WITH_SALES ? 'good' : 'rough',
    status,
    perWeek: Math.round(perWeek * 10) / 10,
    daysLeft,
    safetyStock,
    reorderPoint,
    target,
    orderPieces,
    orderCases,
    estimatedCost: Math.round(orderPieces * (costPrice || price || 0) * 100) / 100,
    weeksOfHistory: weeks.length,
    weeks,
  };
};

module.exports = { forecastItem, weeklyDemand };
