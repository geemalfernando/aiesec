import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { updateCustomer } from '../api/customers';
import { fetchCustomerReport } from '../api/reports';
import { BarChart, lastMonths, RankBars } from '../components/charts';
import CollectPaymentModal from '../components/sales/CollectPaymentModal';
import CustomerForm from '../components/sales/CustomerForm';
import { Alert, Badge, Button, Card, EmptyState, Modal, PageHeader, PageLoading, Stat, Table, Td, Th, useToast } from '../components/ui';
import { apiError, formatDay, money, plural } from '../utils/format';

const STATUS = { paid: ['good', 'Paid'], partial: ['warning', 'Part paid'], cheque_pending: ['info', 'Cheque pending'], unpaid: ['danger', 'Unpaid'] };
const CHEQUE = { pending: ['warning', 'To deposit'], deposited: ['info', 'At the bank'], cleared: ['good', 'Cleared'], bounced: ['danger', 'Bounced'] };

const CustomerDetailPage = () => {
  const { customerId } = useParams();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [collecting, setCollecting] = useState(null);

  const load = useCallback(async () => {
    try {
      setReport(await fetchCustomerReport(customerId));
    } catch (err) {
      setError(apiError(err, 'Could not load this customer.'));
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const back = <Link to="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Customers</Link>;
  if (!report) return <>{back}{error ? <Alert>{error}</Alert> : <PageLoading />}</>;

  const { customer, summary, monthly, topItems, bills, cheques } = report;
  const contact = [customer.phone, customer.address, customer.outletId && `Outlet ${customer.outletId}`].filter(Boolean).join(' · ');

  return (
    <>
      {back}
      <PageHeader
        title={customer.name}
        subtitle={contact || 'No contact details yet'}
        action={<Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" aria-hidden="true" /> Edit</Button>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total bought" value={money(summary.totalSales)} note={plural(summary.billCount, 'bill')} />
        <Stat label="Average bill" value={money(summary.averageBill)} note={summary.lastSale ? `Last ${formatDay(summary.lastSale)}` : 'No bills yet'} />
        <Stat label="Owes" value={money(summary.owed)} note={summary.overdue > 0 ? `${money(summary.overdue)} overdue` : 'Nothing overdue'} tone={summary.overdue > 0 ? 'danger' : 'default'} />
        <Stat label="Cheques not cleared" value={money(summary.chequesPending)} note={summary.bounced ? `${plural(summary.bounced, 'cheque')} bounced before` : 'None bounced'} tone={summary.bounced ? 'warning' : 'default'} />
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="Bought per month, last 12 months"><BarChart data={lastMonths(monthly, 'total')} format={money} emptyTitle="No sales yet" label="Sales per month" /></Card>
        <Card title="What they buy most">
          {topItems.length === 0 ? <EmptyState title="No items yet" /> : <RankBars rows={topItems.map((row) => ({ key: row._id, label: row.name, value: row.total }))} format={money} />}
        </Card>
      </div>
      <Card title={`Bills (${bills.length})`} flush className="mb-6">
        {bills.length === 0 ? <EmptyState title="No bills yet" /> : (
          <Table>
            <thead><tr><Th>Date</Th><Th>Bill</Th><Th>Payment</Th><Th>Status</Th><Th>Due</Th><Th align="right">Total</Th><Th align="right">Balance</Th><Th align="right"><span className="sr-only">Action</span></Th></tr></thead>
            <tbody>
              {bills.map((bill) => {
                const [tone, label] = STATUS[bill.paymentStatus] || (bill.paymentMethod === 'credit' ? STATUS.unpaid : STATUS.paid);
                return (
                  <tr key={bill._id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap text-slate-600">{formatDay(bill.saleDate)}</Td>
                    <Td className="tabular">{bill.billNumber || '-'}</Td>
                    <Td className="capitalize text-slate-600">{bill.paymentMethod}</Td>
                    <Td><Badge tone={tone}>{label}</Badge></Td>
                    <Td className="whitespace-nowrap text-slate-600">{bill.dueDate ? formatDay(bill.dueDate) : '-'}</Td>
                    <Td align="right" className="whitespace-nowrap font-medium">{money(bill.totalAmount)}</Td>
                    <Td align="right" className="whitespace-nowrap text-slate-600">{bill.balanceDue > 0 ? money(bill.balanceDue) : '-'}</Td>
                    <Td align="right">{bill.balanceDue > 0 && <Button size="sm" onClick={() => setCollecting({ ...bill, customerId: customer._id, customerName: customer.name })}>Collect</Button>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      {cheques.length > 0 && (
        <Card title={`Cheques (${cheques.length})`} flush>
          <Table>
            <thead><tr><Th>Cheque date</Th><Th>Cheque no.</Th><Th>Bank</Th><Th>Status</Th><Th align="right">Amount</Th></tr></thead>
            <tbody>
              {cheques.map((cheque) => (
                <tr key={cheque._id}>
                  <Td className="whitespace-nowrap text-slate-600">{formatDay(cheque.chequeDate)}</Td>
                  <Td className="tabular">{cheque.chequeNumber}</Td>
                  <Td>{cheque.bankName}</Td>
                  <Td><Badge tone={CHEQUE[cheque.chequeStatus][0]}>{CHEQUE[cheque.chequeStatus][1]}</Badge></Td>
                  <Td align="right" className="font-medium">{money(cheque.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      {editing && (
        <Modal title={`Edit ${customer.name}`} onClose={() => setEditing(false)}>
          <CustomerForm customer={customer} onCancel={() => setEditing(false)} onSave={async (values) => { await updateCustomer(customer._id, values); setEditing(false); toast('Customer saved.'); load(); }} />
        </Modal>
      )}
      {collecting && <CollectPaymentModal bill={collecting} onClose={() => setCollecting(null)} onCollected={() => { setCollecting(null); toast('Payment recorded.'); load(); }} />}
    </>
  );
};

export default CustomerDetailPage;
