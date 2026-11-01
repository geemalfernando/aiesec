// src/components/sales/CollectPaymentModal.js
import React, { useState } from 'react';
import { recordPayment } from '../../api/payments';
import ChequeFields, { EMPTY_CHEQUE } from './ChequeFields';

const CollectPaymentModal = ({ bill, onClose, onCollected }) => {
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState(bill.balanceDue);
  const [cheque, setCheque] = useState(EMPTY_CHEQUE);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await recordPayment({
        customerId: bill.customerId,
        saleId: bill._id,
        method,
        amount: Number(amount),
        ...(method === 'cheque' && cheque),
      });
      onCollected();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record the payment.');
      setSaving(false);
    }
  };

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-lg">
        <form className="modal-content" onSubmit={handleSubmit}>
          <div className="modal-header">
            <h5 className="modal-title">Collect from {bill.customerName}</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <p>Balance on this bill: <strong>${bill.balanceDue.toFixed(2)}</strong></p>
            <div className="row g-2 mb-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="collectMethod">Received as</label>
                <select id="collectMethod" className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="collectAmount">Amount *</label>
                <input
                  id="collectAmount"
                  type="number"
                  className="form-control"
                  min="0.01"
                  max={bill.balanceDue}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>
            {method === 'cheque' && <ChequeFields cheque={cheque} onChange={setCheque} />}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Saving...' : 'Record payment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CollectPaymentModal;
