// src/utils/format.js
export const money = (value) => `Rs. ${Number(value || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SHORT_DAY = { day: 'numeric', month: 'short', year: 'numeric' };

// Due dates and cheque dates are calendar days stored as UTC midnight.
export const formatDay = (date) => new Date(date).toLocaleDateString('en-GB', { ...SHORT_DAY, timeZone: 'UTC' });
export const formatDateTime = (date) => new Date(date).toLocaleDateString('en-GB', SHORT_DAY);

export const localDayKey = (date = new Date()) => new Date(date).toLocaleDateString('en-CA');

// Whole days from today to a calendar day: negative means it has passed.
export const daysFromToday = (date) => {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date);
  return Math.round((Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()) - today) / 86400000);
};

export const locationName = (location) =>
  String(location || '').replace(/^([a-z]+)([A-Z0-9]+)$/, (_, word, id) => `${word[0].toUpperCase()}${word.slice(1)} ${id}`);

export const stockText = (cases, pieces) => `${cases || 0} cs, ${pieces || 0} pcs`;

export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

export const apiError = (err, fallback) => err?.response?.data?.message || fallback;
