// utils/businessDate.js
// Due dates and cheque dates are calendar days, stored as UTC midnight of that day.
const BUSINESS_TZ = process.env.BUSINESS_TZ || 'Asia/Colombo';

const today = (now = new Date()) => {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(now);
  return new Date(`${ymd}T00:00:00.000Z`);
};

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const parseDay = (value) => {
  const day = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(day.getTime())) {
    const error = new Error(`Invalid date: ${value}`);
    error.statusCode = 400; throw error;
  }
  return day;
};

module.exports = { today, addDays, parseDay };
