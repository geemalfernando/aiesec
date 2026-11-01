import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Download } from 'lucide-react';
import { fetchOrderForecast } from '../api/reports';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, PageLoading, Select, Stat, Table, Td, Th } from '../components/ui';
import { apiError, money, plural } from '../utils/format';

const SETTINGS_KEY = 'order-forecast-settings';
const DEFAULTS = { leadDays: 7, coverDays: 14, serviceLevel: 95 };
const STATUS = { urgent: ['danger', 'Order now'], order: ['warning', 'Order soon'], ok: ['good', 'Enough'], 'no-sales': ['neutral', 'No sales yet'] };
const ORDER = { urgent: 0, order: 1, ok: 2, 'no-sales': 3 };

const loadSettings = () => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return DEFAULTS;
  }
};

const downloadList = (rows) => {
  const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [['Company', 'Item', 'Cases', 'Pieces per case', 'Pieces', 'Estimated cost'], ...rows.map((row) => [row.supplierName || '', row.name, row.orderCases, row.piecesPerCase, row.orderPieces, row.estimatedCost])];
  const url = URL.createObjectURL(new Blob([lines.map((line) => line.map(cell).join(',')).join('\n')], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `order-list-${new Date().toLocaleDateString('en-CA')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const OrderForecastPage = () => {
  const [settings, setSettings] = useState(loadSettings);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setRows(await fetchOrderForecast(settings));
    } catch (err) {
      setError(apiError(err, 'Could not work out what to order.'));
    }
  }, [settings]);

  useEffect(() => {
    load();
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* the settings just will not be remembered */ }
  }, [load, settings]);

  const change = (field) => (e) => setSettings({ ...settings, [field]: Math.max(0, Number(e.target.value) || 0) });

  if (!rows) return <><PageHeader title="What to order" />{error ? <Alert>{error}</Alert> : <PageLoading />}</>;

  const sorted = [...rows].sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9) || a.name.localeCompare(b.name));
  const toOrder = sorted.filter((row) => row.orderPieces > 0);
  const rough = rows.filter((row) => row.confidence === 'rough').length;
  const noSales = rows.filter((row) => row.status === 'no-sales').length;

  return (
    <>
      <PageHeader
        title="What to order"
        subtitle="Worked out from your sales over the last 26 weeks and the stock you have now."
        action={<Button disabled={toOrder.length === 0} onClick={() => downloadList(toOrder)}><Download className="h-4 w-4" aria-hidden="true" /> Download order list</Button>}
      />
      {error && <Alert className="mb-4">{error}</Alert>}
      {rough > 0 && (
        <Alert tone="warning" className="mb-4">
          {plural(rough, 'item')} {rough === 1 ? 'has' : 'have'} under 8 weeks of sales, or sales in under 4 of them, so {rough === 1 ? 'its figure is a rough guess' : 'those figures are rough guesses'}. Use your own judgement until more bills are entered.
        </Alert>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Items to order" value={toOrder.length} tone={toOrder.some((row) => row.status === 'urgent') ? 'danger' : 'default'} note={`${toOrder.filter((row) => row.status === 'urgent').length} urgent`} />
        <Stat label="Estimated cost" value={money(toOrder.reduce((sum, row) => sum + row.estimatedCost, 0))} note="Latest cost, or selling price if none" />
        <Stat label="Rough guesses" value={rough} tone={rough ? 'warning' : 'default'} />
        <Stat label="No sales yet" value={noSales} note="Not forecast" />
      </div>
      <Card title="Settings" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Days for an order to arrive" hint="From ordering to stock in hand"><Input type="number" min="0" max="90" value={settings.leadDays} onChange={change('leadDays')} /></Field>
          <Field label="Days each order should last" hint="Until the next order"><Input type="number" min="0" max="180" value={settings.coverDays} onChange={change('coverDays')} /></Field>
          <Field label="How rarely to run out" hint="Higher keeps more stock and ties up more money">
            <Select value={settings.serviceLevel} onChange={change('serviceLevel')}>
              <option value={90}>Normal (90%)</option>
              <option value={95}>Careful (95%)</option>
              <option value={98}>Very careful (98%)</option>
            </Select>
          </Field>
        </div>
      </Card>
      <Card flush>
        {rows.length === 0 ? <EmptyState icon={CheckCircle2} title="No stock items yet" /> : (
          <Table>
            <thead><tr><Th>Item</Th><Th>Action</Th><Th align="right">In stock</Th><Th align="right">Sells per week</Th><Th align="right">Lasts</Th><Th align="right">Order when under</Th><Th align="right">Order</Th><Th align="right">Cost</Th></tr></thead>
            <tbody>
              {sorted.map((row) => {
                const [tone, label] = STATUS[row.status];
                return (
                  <tr key={row.name} className="hover:bg-slate-50">
                    <Td><Link to={`/stock/items/${encodeURIComponent(row.name)}`} className="font-medium text-brand-700 hover:underline">{row.name}</Link><div className="text-xs text-slate-500">{row.supplierName || 'No company yet'}{row.confidence === 'rough' ? ` · ${plural(row.weeksOfHistory, 'week')} of sales` : ''}</div></Td>
                    <Td><span className="flex flex-wrap gap-1"><Badge tone={tone}>{label}</Badge>{row.confidence === 'rough' && <Badge>Rough guess</Badge>}</span></Td>
                    <Td align="right">{row.stock}</Td>
                    <Td align="right">{row.status === 'no-sales' ? '-' : row.perWeek}</Td>
                    <Td align="right" className="whitespace-nowrap">{row.daysLeft === null ? '-' : plural(row.daysLeft, 'day')}</Td>
                    <Td align="right">{row.status === 'no-sales' ? '-' : row.reorderPoint}</Td>
                    <Td align="right" className="whitespace-nowrap font-medium">{row.orderPieces > 0 ? <>{plural(row.orderCases, 'case')}<div className="text-xs font-normal text-slate-500">{row.orderPieces} pieces</div></> : '-'}</Td>
                    <Td align="right" className="whitespace-nowrap">{row.estimatedCost > 0 ? money(row.estimatedCost) : '-'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
};

export default OrderForecastPage;
