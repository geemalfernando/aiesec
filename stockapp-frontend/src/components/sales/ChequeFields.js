// src/components/sales/ChequeFields.js
import React from 'react';

const ChequeFields = ({ cheque, onChange }) => {
  const set = (field) => (e) => onChange({ ...cheque, [field]: e.target.value });
  return (
    <div className="row g-2">
      <div className="col-md-4">
        <label className="form-label" htmlFor="chequeNumber">Cheque number *</label>
        <input id="chequeNumber" className="form-control" value={cheque.chequeNumber} onChange={set('chequeNumber')} required />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor="bankName">Bank *</label>
        <input id="bankName" className="form-control" value={cheque.bankName} onChange={set('bankName')} required />
      </div>
      <div className="col-md-4">
        <label className="form-label" htmlFor="chequeDate">Cheque date (deposit day) *</label>
        <input id="chequeDate" type="date" className="form-control" value={cheque.chequeDate} onChange={set('chequeDate')} required />
      </div>
    </div>
  );
};

export const EMPTY_CHEQUE = { chequeNumber: '', bankName: '', chequeDate: '' };
export const chequeComplete = (cheque) => Boolean(cheque.chequeNumber && cheque.bankName && cheque.chequeDate);

export default ChequeFields;
