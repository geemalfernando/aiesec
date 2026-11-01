// src/components/sales/CollectPaymentModal.js
import React, { useState } from 'react';
import { recordPayment } from '../../api/payments';
import { apiError, money } from '../../utils/format';
import { Alert, Button, Field, Input, Modal, Select } from '../ui';
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
      setError(apiError(err, 'Could not record the payment.'));
      setSaving(false);
    }
  };

  return (
    <Modal title={`Collect from ${bill.customerName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="grid gap-4">
        {error && <Alert>{error}</Alert>}
        <p className="text-sm text-slate-600">Balance on this bill: <strong className="tabular text-slate-900">{money(bill.balanceDue)}</strong></p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Received as">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
            </Select>
          </Field>
          <Field label="Amount">
            <Input type="number" min="0.01" max={bill.balanceDue} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
        </div>
        {method === 'cheque' && <ChequeFields cheque={cheque} onChange={setCheque} />}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" busy={saving}>Record payment</Button>
        </div>
      </form>
    </Modal>
  );
};

export default CollectPaymentModal;
