// src/components/sales/ChequeFields.js
import React from 'react';
import { Field, Input } from '../ui';

const ChequeFields = ({ cheque, onChange }) => {
  const set = (field) => (e) => onChange({ ...cheque, [field]: e.target.value });
  return (
    <div className="grid gap-3">
      <Field label="Cheque number"><Input value={cheque.chequeNumber} onChange={set('chequeNumber')} required /></Field>
      <Field label="Bank"><Input value={cheque.bankName} onChange={set('bankName')} required /></Field>
      <Field label="Cheque date" hint="The day it can be deposited"><Input type="date" value={cheque.chequeDate} onChange={set('chequeDate')} required /></Field>
    </div>
  );
};

export const EMPTY_CHEQUE = { chequeNumber: '', bankName: '', chequeDate: '' };
export const chequeComplete = (cheque) => Boolean(cheque.chequeNumber && cheque.bankName && cheque.chequeDate);

export default ChequeFields;
