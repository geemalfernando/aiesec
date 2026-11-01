import React, { useCallback, useEffect, useState } from 'react';
import { Receipt, Search } from 'lucide-react';
import { fetchDueBills, fetchOverdueBills } from '../api/sales';
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, PageLoading, Stat, Table, Td, Th, useToast } from '../components/ui';
import CollectPaymentModal from '../components/sales/CollectPaymentModal';
import { apiError, daysFromToday, formatDay, money, plural } from '../utils/format';

const FILTERS = [['all', 'All'], ['overdue', 'Overdue'], ['week', 'Due in 7 days']];

const dueBadge = (days) => {
  if (days < 0) return <Badge tone="danger">{plural(-days, 'day')} overdue</Badge>;
  if (days === 0) return <Badge tone="warning">Due today</Badge>;
  return <Badge tone={days <= 7 ? 'warning' : 'neutral'}>{plural(days, 'day')} left</Badge>;
};

const CreditBillsPage = () => {
  const toast = useToast();
  const [bills, setBills] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [collecting, setCollecting] = useState(null);

  const load = useCallback(async () => {
    try {
      const [due, overdue] = await Promise.all([fetchDueBills(), fetchOverdueBills()]);
      setBills([...overdue, ...due]);
    } catch (err) {
      setError(apiError(err, 'Could not load credit bills.'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error && !bills) return <><PageHeader title="Credit bills" /><Alert>{error}</Alert></>;
  if (!bills) return <><PageHeader title="Credit bills" /><PageLoading /></>;

  const total = (rows) => rows.reduce((sum, bill) => sum + (bill.balanceDue || 0), 0);
  const overdue = bills.filter((bill) => daysFromToday(bill.dueDate) < 0);
  const week = bills.filter((bill) => { const d = daysFromToday(bill.dueDate); return d >= 0 && d <= 7; });
  const shown = (filter === 'overdue' ? overdue : filter === 'week' ? week : bills)
    .filter((bill) => bill.customerName?.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <>
      <PageHeader title="Credit bills" subtitle="Bills are due 21 days after the bill date unless you set another." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="To collect" value={money(total(bills))} note={plural(bills.length, 'open bill')} />
        <Stat label="Overdue" value={money(total(overdue))} note={plural(overdue.length, 'bill')} tone={overdue.length ? 'danger' : 'default'} />
        <Stat label="Due in 7 days" value={money(total(week))} note={plural(week.length, 'bill')} tone={week.length ? 'warning' : 'default'} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5" role="group" aria-label="Filter bills">
          {FILTERS.map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${filter === key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
          <Input className="pl-9" placeholder="Search customer" aria-label="Search customer" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <Card flush>
        {shown.length === 0 ? (
          <EmptyState icon={Receipt} title={bills.length ? 'No bills match' : 'No open credit bills'}>{bills.length ? 'Try another filter.' : 'Credit sales you enter will appear here.'}</EmptyState>
        ) : (
          <Table>
            <thead><tr><Th>Customer</Th><Th>Sale date</Th><Th>Due date</Th><Th>Status</Th><Th align="right">Balance</Th><Th align="right"><span className="sr-only">Action</span></Th></tr></thead>
            <tbody>
              {shown.map((bill) => (
                <tr key={bill._id} className="hover:bg-slate-50">
                  <Td className="font-medium">{bill.customerName}</Td>
                  <Td className="whitespace-nowrap text-slate-600">{formatDay(bill.saleDate || bill.createdAt)}</Td>
                  <Td className="whitespace-nowrap text-slate-600">{formatDay(bill.dueDate)}</Td>
                  <Td>{dueBadge(daysFromToday(bill.dueDate))}</Td>
                  <Td align="right" className="font-medium">{money(bill.balanceDue)}</Td>
                  <Td align="right"><Button size="sm" onClick={() => setCollecting(bill)}>Collect</Button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {collecting && (
        <CollectPaymentModal
          bill={collecting}
          onClose={() => setCollecting(null)}
          onCollected={() => { setCollecting(null); toast('Payment recorded.'); load(); }}
        />
      )}
    </>
  );
};

export default CreditBillsPage;
