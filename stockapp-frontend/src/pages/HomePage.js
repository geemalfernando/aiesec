import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Boxes, Camera, CheckCircle2, Landmark, PencilLine, Receipt } from 'lucide-react';
import { fetchCreditCustomerSummary } from '../api/dashboard';
import { fetchInventoryItems } from '../api/inventory';
import { fetchChequeTracker } from '../api/payments';
import { fetchDueBills, fetchOverdueBills, fetchSalesHistory } from '../api/sales';
import { Alert, Button, buttonClass, Card, EmptyState, PageHeader, PageLoading, Stat } from '../components/ui';
import { daysFromToday, formatDay, localDayKey, locationName, money, plural } from '../utils/format';

const LOW_STOCK_PIECES = 10;
const CHART_DAYS = 14;

const SalesChart = ({ sales }) => {
  const days = Array.from({ length: CHART_DAYS }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (CHART_DAYS - 1 - i));
    return { key: localDayKey(date), label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), total: 0 };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));
  sales.forEach((sale) => {
    const day = byKey.get(localDayKey(sale.saleDate || sale.createdAt));
    if (day) day.total += sale.totalAmount || 0;
  });
  const peak = Math.max(...days.map((day) => day.total), 1);
  const period = days.reduce((sum, day) => sum + day.total, 0);

  return (
    <Card title={`Sales, last ${CHART_DAYS} days`} action={<span className="tabular text-sm font-medium text-slate-700">{money(period)}</span>}>
      {period === 0 ? (
        <EmptyState title="No sales in this period" />
      ) : (
        <>
          <div className="flex h-40 items-end gap-0.5 border-b border-slate-200">
            {days.map((day) => (
              <div key={day.key} className="group relative flex h-full flex-1 items-end hover:bg-slate-100" tabIndex={0} aria-label={`${day.label}: ${money(day.total)}`}>
                <div className="w-full rounded-t bg-brand-500" style={{ height: `${(day.total / peak) * 100}%` }} />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block group-focus:block">
                  {day.label}: {money(day.total)}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span>{days[0].label}</span>
            <span>Today</span>
          </div>
        </>
      )}
    </Card>
  );
};

const TaskRow = ({ to, icon: Icon, tone, title, detail, amount }) => (
  <li>
    <Link to={to} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="block truncate text-xs text-slate-500">{detail}</span>
      </span>
      {amount !== undefined && <span className="tabular text-sm font-medium text-slate-900">{money(amount)}</span>}
    </Link>
  </li>
);

const sum = (rows, field) => rows.reduce((total, row) => total + (row[field] || 0), 0);
const RED = 'bg-red-100 text-red-700';
const AMBER = 'bg-amber-100 text-amber-800';

const HomePage = () => {
  const navigate = useNavigate();
  const fileInput = useRef(null);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const load = async () => {
      const results = await Promise.allSettled([
        fetchSalesHistory(), fetchChequeTracker(), fetchDueBills(), fetchOverdueBills(), fetchInventoryItems(), fetchCreditCustomerSummary(),
      ]);
      const [sales, cheques, due, overdue, stock, owing] = results.map((r) => (r.status === 'fulfilled' ? r.value : null));
      setFailed(results.some((r) => r.status === 'rejected'));
      setData({
        sales: sales || [],
        cheques: cheques || { missed: [], dueToday: [], upcoming: [], deposited: [], bounced: [], cleared: [] },
        due: due || [],
        overdue: overdue || [],
        stock: stock || [],
        owing: owing || [],
      });
    };
    load();
  }, []);

  const handleBillChosen = (e) => {
    const file = e.target.files[0];
    if (file) navigate('/sales/new', { state: { billFile: file } });
  };

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const billActions = (
    <div className="flex flex-wrap gap-2">
      <input ref={fileInput} type="file" accept="image/*" className="hidden" aria-label="Bill image" onChange={handleBillChosen} />
      <Button onClick={() => fileInput.current.click()}><Camera className="h-4 w-4" aria-hidden="true" /> Add bill image</Button>
      <Link to="/sales/new" className={buttonClass('secondary')}><PencilLine className="h-4 w-4" aria-hidden="true" /> Enter manually</Link>
    </div>
  );

  if (!data) {
    return <><PageHeader title="Home" subtitle={today} action={billActions} /><PageLoading /></>;
  }

  const { sales, cheques, due, overdue, stock, owing } = data;
  const todayKey = localDayKey();
  const monthKey = todayKey.slice(0, 7);
  const dayOf = (sale) => localDayKey(sale.saleDate || sale.createdAt);
  const salesToday = sales.filter((sale) => dayOf(sale) === todayKey);
  const salesMonth = sales.filter((sale) => dayOf(sale).startsWith(monthKey));
  const dueThisWeek = due.filter((bill) => daysFromToday(bill.dueDate) <= 7);
  const toDeposit = [...cheques.missed, ...cheques.dueToday];
  const lowStock = stock.filter((item) => item.quantity < LOW_STOCK_PIECES);

  const hasTasks = cheques.missed.length || cheques.dueToday.length || cheques.bounced.length || overdue.length || dueThisWeek.length || lowStock.length;

  return (
    <>
      <PageHeader title="Home" subtitle={today} action={billActions} />
      {failed && <Alert className="mb-4">Some information could not be loaded, so this page may be incomplete.</Alert>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales today" value={money(sum(salesToday, 'totalAmount'))} note={plural(salesToday.length, 'sale')} />
        <Stat label="Sales this month" value={money(sum(salesMonth, 'totalAmount'))} note={plural(salesMonth.length, 'sale')} />
        <Stat label="To collect" value={money(sum(due, 'balanceDue') + sum(overdue, 'balanceDue'))} note={plural(due.length + overdue.length, 'open bill')} />
        <Stat label="Overdue" value={money(sum(overdue, 'balanceDue'))} note={plural(overdue.length, 'bill')} tone={overdue.length ? 'danger' : 'default'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card title="Needs attention" flush>
            {!hasTasks ? (
              <EmptyState icon={CheckCircle2} title="Nothing needs attention today" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {cheques.missed.length > 0 && <TaskRow to="/cheques" icon={Landmark} tone={RED} title={`Deposit ${plural(cheques.missed.length, 'missed cheque')}`} detail={`Oldest dated ${formatDay(cheques.missed[0].chequeDate)}`} amount={sum(cheques.missed, 'amount')} />}
                {cheques.dueToday.length > 0 && <TaskRow to="/cheques" icon={Landmark} tone={AMBER} title={`Deposit ${plural(cheques.dueToday.length, 'cheque')} today`} detail={cheques.dueToday.map((c) => c.customer?.name).filter(Boolean).join(', ')} amount={sum(cheques.dueToday, 'amount')} />}
                {cheques.bounced.length > 0 && <TaskRow to="/cheques" icon={Landmark} tone={RED} title={`${plural(cheques.bounced.length, 'bounced cheque')} recorded`} detail="The amount is back on the customer's bill" amount={sum(cheques.bounced, 'amount')} />}
                {overdue.length > 0 && <TaskRow to="/credit" icon={Receipt} tone={RED} title={`Collect ${plural(overdue.length, 'overdue bill')}`} detail={[...new Set(overdue.map((b) => b.customerName))].join(', ')} amount={sum(overdue, 'balanceDue')} />}
                {dueThisWeek.length > 0 && <TaskRow to="/credit" icon={Receipt} tone={AMBER} title={`${plural(dueThisWeek.length, 'bill')} due within 7 days`} detail={[...new Set(dueThisWeek.map((b) => b.customerName))].join(', ')} amount={sum(dueThisWeek, 'balanceDue')} />}
                {lowStock.length > 0 && <TaskRow to="/stock" icon={Boxes} tone={AMBER} title={`${plural(lowStock.length, 'stock line')} low or empty`} detail={lowStock.slice(0, 4).map((i) => `${i.name} (${locationName(i.location)})`).join(', ')} />}
              </ul>
            )}
          </Card>
          {toDeposit.length === 0 && cheques.upcoming.length > 0 && (
            <p className="mt-3 text-sm text-slate-500">Next cheque to deposit: {cheques.upcoming[0].customer?.name}, {formatDay(cheques.upcoming[0].chequeDate)}.</p>
          )}
        </div>
        <div className="grid content-start gap-6 lg:col-span-2">
          <SalesChart sales={sales} />
          <Card title="Who owes the most" flush>
            {owing.length === 0 ? (
              <EmptyState title="No customer owes anything" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {[...owing].sort((a, b) => b.totalAmountOwed - a.totalAmountOwed).slice(0, 5).map((row) => (
                  <li key={row._id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="truncate text-slate-700">{row.customerName}</span>
                    <span className="tabular font-medium text-slate-900">{money(row.totalAmountOwed)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
};

export default HomePage;
