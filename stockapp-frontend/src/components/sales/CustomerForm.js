// src/components/sales/CustomerForm.js
import React, { useState } from 'react';
import { apiError } from '../../utils/format';
import { Alert, Button, Field, Input, Select } from '../ui';

const CustomerForm = ({ customer = {}, onSave, onCancel }) => {
  const [values, setValues] = useState({
    name: customer.name || '',
    phone: customer.phone || '',
    email: customer.email || '',
    customerType: customer.customerType || 'cash',
    creditDays: customer.creditDays ?? 21,
    address: customer.address || '',
    outletId: customer.outletId || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setValues({ ...values, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave({ ...values, creditDays: Number(values.creditDays) });
    } catch (err) {
      setError(apiError(err, 'Could not save this customer.'));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {error && <Alert>{error}</Alert>}
      <Field label="Name"><Input value={values.name} onChange={set('name')} maxLength={100} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone (optional)"><Input type="tel" value={values.phone} onChange={set('phone')} /></Field>
        <Field label="Email (optional)"><Input type="email" value={values.email} onChange={set('email')} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Address (optional)" className="col-span-2"><Input value={values.address} onChange={set('address')} /></Field>
        <Field label="Outlet ID"><Input value={values.outletId} onChange={set('outletId')} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Usually pays by">
          <Select value={values.customerType} onChange={set('customerType')}>
            <option value="cash">Cash</option>
            <option value="credit">Credit</option>
          </Select>
        </Field>
        <Field label="Credit days" hint="Used when a bill is on credit"><Input type="number" min="0" value={values.creditDays} onChange={set('creditDays')} required /></Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" busy={saving}>Save customer</Button>
      </div>
    </form>
  );
};

export default CustomerForm;
