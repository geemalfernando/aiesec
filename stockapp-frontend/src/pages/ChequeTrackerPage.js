import React, { useCallback, useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { fetchChequeTracker, updateChequeStatus } from '../api/payments';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, PageLoading, Stat, Table, Td, Th, useToast } from '../components/ui';
import { apiError, daysFromToday, formatDay, money, plural } from '../utils/format';

const SECTIONS = [
  { key: 'missed', title: 'Missed: deposit as soon as possible' },
  { key: 'dueToday', title: 'Deposit today' },
  { key: 'deposited', title: 'At the bank: waiting to clear' },
  { key: 'bounced', title: 'Bounced: collect again' },
  { key: 'upcoming', title: 'Upcoming' },
];

const total = (cheques) => cheques.reduce((sum, c) => sum + c.amount, 0);

const ChequeTable = ({ cheques, sectionKey, onChange, busyId }) => (
  <Table>
    <thead><tr><Th>Cheque date</Th><Th>Customer</Th><Th>Cheque no.</Th><Th>Bank</Th><Th align="right">Amount</Th><Th align="right">{sectionKey === 'bounced' ? 'Reason' : <span className="sr-only">Action</span>}</Th></tr></thead>
    <tbody>
      {cheques.map((cheque) => {
        const days = daysFromToday(cheque.chequeDate);
        return (
          <tr key={cheque._id} className="hover:bg-slate-50">
            <Td className="whitespace-nowrap">
              {formatDay(cheque.chequeDate)}
              {sectionKey === 'missed' && <div className="mt-0.5"><Badge tone="danger">{plural(-days, 'day')} late</Badge></div>}
              {sectionKey === 'upcoming' && <div className="mt-0.5 text-xs text-slate-500">in {plural(days, 'day')}</div>}
            </Td>
            <Td><span className="font-medium">{cheque.customer?.name || 'Unknown'}</span>{cheque.customer?.phone && <div className="text-xs text-slate-500">{cheque.customer.phone}</div>}</Td>
            <Td className="tabular">{cheque.chequeNumber}</Td>
            <Td>{cheque.bankName}</Td>
            <Td align="right" className="font-medium">{money(cheque.amount)}</Td>
            <Td align="right" className="whitespace-nowrap">
              {(sectionKey === 'missed' || sectionKey === 'dueToday') && <Button size="sm" busy={busyId === cheque._id} onClick={() => onChange(cheque, 'deposited')}>Mark deposited</Button>}
              {sectionKey === 'deposited' && (
                <span className="inline-flex gap-2">
                  <Button size="sm" busy={busyId === cheque._id} onClick={() => onChange(cheque, 'cleared')}>Cleared</Button>
                  <Button size="sm" variant="secondary" onClick={() => onChange(cheque, 'bounced')}>Bounced</Button>
                </span>
              )}
              {sectionKey === 'bounced' && <span className="font-sans text-slate-600">{cheque.bounceReason || 'Not given'}</span>}
            </Td>
          </tr>
        );
      })}
    </tbody>
  </Table>
);

const ChequeTrackerPage = () => {
  const toast = useToast();
  const [tracker, setTracker] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [bouncing, setBouncing] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setTracker(await fetchChequeTracker());
    } catch (err) {
      setError(apiError(err, 'Could not load cheques.'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyStatus = async (cheque, status, bounceReason) => {
    setError('');
    setBusyId(cheque._id);
    try {
      await updateChequeStatus(cheque._id, status, bounceReason);
      await load();
      toast(`Cheque ${cheque.chequeNumber} marked ${status}.`);
    } catch (err) {
      setError(apiError(err, 'Could not update the cheque.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleChange = (cheque, status) => {
    if (status === 'bounced') {
      setReason('');
      setBouncing(cheque);
    } else {
      applyStatus(cheque, status);
    }
  };

  const confirmBounce = async (e) => {
    e.preventDefault();
    const cheque = bouncing;
    setBouncing(null);
    await applyStatus(cheque, 'bounced', reason);
  };

  if (!tracker) return <><PageHeader title="Cheques" />{error ? <Alert>{error}</Alert> : <PageLoading />}</>;

  const toDeposit = [...tracker.missed, ...tracker.dueToday];
  const active = SECTIONS.filter(({ key }) => tracker[key].length > 0);

  return (
    <>
      <PageHeader title="Cheques" subtitle="A cheque counts as paid only after it clears." />
      {error && <Alert className="mb-4">{error}</Alert>}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="To deposit now" value={money(total(toDeposit))} note={plural(toDeposit.length, 'cheque')} tone={tracker.missed.length ? 'danger' : toDeposit.length ? 'warning' : 'default'} />
        <Stat label="At the bank" value={money(total(tracker.deposited))} note={plural(tracker.deposited.length, 'cheque')} />
        <Stat label="Upcoming" value={money(total(tracker.upcoming))} note={plural(tracker.upcoming.length, 'cheque')} />
        <Stat label="Bounced" value={money(total(tracker.bounced))} note={plural(tracker.bounced.length, 'cheque')} tone={tracker.bounced.length ? 'danger' : 'default'} />
      </div>
      <div className="grid gap-6">
        {active.length === 0 && tracker.cleared.length === 0 && (
          <Card flush><EmptyState icon={Landmark} title="No cheques yet">Cheques from sales and bill payments will appear here.</EmptyState></Card>
        )}
        {active.map(({ key, title }) => (
          <Card key={key} flush title={`${title} (${tracker[key].length})`} action={<span className="tabular text-sm font-medium text-slate-700">{money(total(tracker[key]))}</span>}>
            <ChequeTable cheques={tracker[key]} sectionKey={key} onChange={handleChange} busyId={busyId} />
          </Card>
        ))}
        {tracker.cleared.length > 0 && (
          <details className="rounded-xl border border-slate-200 bg-white">
            <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-slate-900">Cleared ({tracker.cleared.length})</summary>
            <ChequeTable cheques={tracker.cleared} sectionKey="cleared" onChange={handleChange} busyId={busyId} />
          </details>
        )}
      </div>
      {bouncing && (
        <Modal title={`Cheque ${bouncing.chequeNumber} bounced`} onClose={() => setBouncing(null)}>
          <form onSubmit={confirmBounce} className="grid gap-4">
            <p className="text-sm text-slate-600">{money(bouncing.amount)} will go back on {bouncing.customer?.name || 'the customer'}'s bill. This cannot be undone.</p>
            <Field label="Reason (optional)"><Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="For example, insufficient funds" /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setBouncing(null)}>Cancel</Button>
              <Button type="submit" variant="danger">Mark bounced</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default ChequeTrackerPage;
