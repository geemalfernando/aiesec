import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileClock, Search } from 'lucide-react';
import { fetchSalesHistory } from '../api/sales';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, PageLoading, Select, Stat, Table, Td, Th } from '../components/ui';
import { apiError, formatDateTime, localDayKey, locationName, money, plural } from '../utils/format';

const PAGE_SIZE = 50;

const STATUS = {
  paid: ['good', 'Paid'],
  partial: ['warning', 'Part paid'],
  cheque_pending: ['info', 'Cheque pending'],
  unpaid: ['danger', 'Unpaid'],
};

const saleStatus = (sale) => {
  if (sale.paymentStatus) return sale.paymentStatus;
  return sale.paymentMethod === 'credit' ? 'unpaid' : 'paid';
};

const SalesHistoryPage = () => {
  const [sales, setSales] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [date, setDate] = useState('');
  const [open, setOpen] = useState(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    fetchSalesHistory().then(setSales).catch((err) => setError(apiError(err, 'Could not load sales.')));
  }, []);

  const shown = useMemo(() => (sales || []).filter((sale) => {
    const term = search.trim().toLowerCase();
    return (!term || sale.customerName?.toLowerCase().includes(term))
      && (!method || sale.paymentMethod === method)
      && (!date || localDayKey(sale.saleDate || sale.createdAt) === date);
  }), [sales, search, method, date]);

  if (!sales) return <><PageHeader title="Sales history" />{error ? <Alert>{error}</Alert> : <PageLoading />}</>;

  const totalOf = (paymentMethod) => shown.filter((s) => !paymentMethod || s.paymentMethod === paymentMethod).reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  return (
    <>
      <PageHeader title="Sales history" subtitle={plural(shown.length, 'sale')} />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total" value={money(totalOf())} />
        <Stat label="Cash" value={money(totalOf('cash'))} />
        <Stat label="Cheque" value={money(totalOf('cheque'))} />
        <Stat label="Credit" value={money(totalOf('credit'))} />
      </div>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Field label="Customer">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" />
            <Input className="pl-9" placeholder="Search customer" aria-label="Search customer" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </Field>
        <Field label="Payment">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">All</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="credit">Credit</option>
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <Card flush>
        {shown.length === 0 ? (
          <EmptyState icon={FileClock} title={sales.length ? 'No sales match' : 'No sales yet'} />
        ) : (
          <Table>
            <thead><tr><Th><span className="sr-only">Details</span></Th><Th>Date</Th><Th>Customer</Th><Th>Payment</Th><Th>Status</Th><Th align="right">Total</Th><Th align="right">Balance</Th></tr></thead>
            <tbody>
              {shown.slice(0, limit).map((sale) => {
                const [tone, label] = STATUS[saleStatus(sale)];
                const isOpen = open === sale._id;
                return (
                  <React.Fragment key={sale._id}>
                    <tr className="hover:bg-slate-50">
                      <Td className="w-8 pr-0">
                        <button type="button" className="rounded p-1 text-slate-400 hover:text-slate-700" aria-expanded={isOpen} aria-label={`Items in sale for ${sale.customerName}`} onClick={() => setOpen(isOpen ? null : sale._id)}>
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </Td>
                      <Td className="whitespace-nowrap text-slate-600">{formatDateTime(sale.saleDate || sale.createdAt)}</Td>
                      <Td className="font-medium">{sale.customerName}{(sale.billNumber || sale.agency) && <div className="text-xs font-normal capitalize text-slate-500">{[sale.billNumber && `Bill ${sale.billNumber}`, sale.agency].filter(Boolean).join(' · ')}</div>}</Td>
                      <Td className="capitalize text-slate-600">{sale.paymentMethod}</Td>
                      <Td><Badge tone={tone}>{label}</Badge></Td>
                      <Td align="right" className="whitespace-nowrap font-medium">{money(sale.totalAmount)}</Td>
                      <Td align="right" className="whitespace-nowrap text-slate-600">{sale.balanceDue ? money(sale.balanceDue) : '-'}</Td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan="7" className="border-b border-slate-100 bg-slate-50 px-12 py-3">
                          <ul className="grid gap-1 text-sm text-slate-700">
                            {sale.items.map((item) => (
                              <li key={`${item.itemId?._id || item.itemId}-${item.locationTakenFrom}`} className="flex flex-wrap justify-between gap-3">
                                <span>{item.name} from {locationName(item.locationTakenFrom)}: {item.cases} cs, {item.pieces} pcs</span>
                                <span className="tabular">{money(item.priceAtSale * item.quantity)}</span>
                              </li>
                            ))}
                            {sale.discountAmount > 0 && <li className="text-slate-500">Discount: {money(sale.discountAmount)}</li>}
                            {sale.discountPercentage > 0 && <li className="text-slate-500">Discount: {sale.discountPercentage}%</li>}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      {shown.length > limit && <div className="mt-4 text-center"><Button variant="secondary" onClick={() => setLimit(limit + PAGE_SIZE)}>Show more</Button></div>}
    </>
  );
};

export default SalesHistoryPage;
