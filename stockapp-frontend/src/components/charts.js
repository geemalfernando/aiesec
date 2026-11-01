// src/components/charts.js
import React from 'react';
import { EmptyState } from './ui';

// One series over time. Bars grow from the baseline; hover or focus a bar for its value.
export const BarChart = ({ data, format = String, emptyTitle = 'Nothing to show yet', label }) => {
  if (!data.some((row) => row.value > 0)) return <EmptyState title={emptyTitle} />;
  const peak = Math.max(...data.map((row) => row.value));
  return (
    <figure aria-label={label}>
      <div className="flex h-40 items-end gap-0.5 border-b border-slate-200">
        {data.map((row) => (
          <div key={row.key} className="group relative flex h-full flex-1 items-end hover:bg-slate-100 focus:bg-slate-100" tabIndex={0} aria-label={`${row.label}: ${format(row.value)}`}>
            <div className="w-full rounded-t bg-brand-500" style={{ height: `${(row.value / peak) * 100}%` }} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block group-focus:block">
              {row.label}: {format(row.value)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </figure>
  );
};

// A ranked list: each row names itself and shows its own value.
export const RankBars = ({ rows, format = String }) => {
  const peak = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="grid gap-3">
      {rows.map((row) => (
        <li key={row.key} className="text-sm">
          <div className="mb-1 flex justify-between gap-3">
            <span className="truncate text-slate-700">{row.label}</span>
            <span className="tabular whitespace-nowrap font-medium text-slate-900">{format(row.value)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(row.value / peak) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
};

// The last n months with gaps filled, from rows such as { month: '2026-10', total: 50 }.
export const lastMonths = (rows, field, count = 12) => {
  const byMonth = new Map(rows.map((row) => [row.month, row[field]]));
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), value: byMonth.get(key) || 0 };
  });
};
