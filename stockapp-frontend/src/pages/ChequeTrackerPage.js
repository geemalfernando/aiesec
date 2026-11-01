// src/pages/ChequeTrackerPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { fetchChequeTracker, updateChequeStatus } from '../api/payments';

const SECTIONS = [
  { key: 'missed', title: 'Missed: should already be deposited', border: 'danger' },
  { key: 'dueToday', title: 'Deposit today', border: 'warning' },
  { key: 'deposited', title: 'At the bank: waiting to clear', border: 'primary' },
  { key: 'bounced', title: 'Bounced: collect again', border: 'danger' },
  { key: 'upcoming', title: 'Upcoming', border: 'secondary' },
  { key: 'cleared', title: 'Cleared', border: 'success' },
];

const formatDay = (date) => new Date(date).toLocaleDateString(undefined, { timeZone: 'UTC' });

const ChequeTrackerPage = () => {
  const [tracker, setTracker] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setTracker(await fetchChequeTracker());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load cheques.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (cheque, status) => {
    let reason;
    if (status === 'bounced') {
      reason = window.prompt(`Why did cheque ${cheque.chequeNumber} bounce?`);
      if (reason === null) return;
    }
    setError('');
    try {
      await updateChequeStatus(cheque._id, status, reason);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update the cheque.');
    }
  };

  if (!tracker) {
    return <div className="container py-4">{error || 'Loading cheques...'}</div>;
  }

  return (
    <div className="container py-4">
      <h1 className="h3 mb-4">Cheque Tracker</h1>
      {error && <div className="alert alert-danger">{error}</div>}
      {SECTIONS.map(({ key, title, border }) => {
        const cheques = tracker[key];
        const total = cheques.reduce((sum, c) => sum + c.amount, 0);
        return (
          <section key={key} className={`card mb-4 border-${border}`} aria-label={title}>
            <div className="card-header d-flex justify-content-between">
              <strong>{title} ({cheques.length})</strong>
              <span>${total.toFixed(2)}</span>
            </div>
            {cheques.length === 0 ? (
              <div className="card-body text-muted">None.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>Cheque date</th>
                      <th>Customer</th>
                      <th>Cheque no.</th>
                      <th>Bank</th>
                      <th className="text-end">Amount</th>
                      <th>{key === 'bounced' ? 'Reason' : ''}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cheques.map((cheque) => (
                      <tr key={cheque._id}>
                        <td>{formatDay(cheque.chequeDate)}</td>
                        <td>{cheque.customer?.name || 'N/A'}{cheque.customer?.phone ? ` (${cheque.customer.phone})` : ''}</td>
                        <td>{cheque.chequeNumber}</td>
                        <td>{cheque.bankName}</td>
                        <td className="text-end">${cheque.amount.toFixed(2)}</td>
                        <td className="text-end">
                          {(key === 'missed' || key === 'dueToday') && (
                            <button className="btn btn-sm btn-primary" onClick={() => changeStatus(cheque, 'deposited')}>Mark deposited</button>
                          )}
                          {key === 'deposited' && (
                            <>
                              <button className="btn btn-sm btn-success me-2" onClick={() => changeStatus(cheque, 'cleared')}>Cleared</button>
                              <button className="btn btn-sm btn-outline-danger" onClick={() => changeStatus(cheque, 'bounced')}>Bounced</button>
                            </>
                          )}
                          {key === 'bounced' && <span className="text-start d-block">{cheque.bounceReason || 'Not given'}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default ChequeTrackerPage;
