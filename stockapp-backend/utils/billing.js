// utils/billing.js
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Sales recorded before payments existed have no balanceDue; their whole total is still owed.
const OPEN_BILL_MATCH = {
  paymentMethod: { $in: ['credit', 'cheque'] },
  $or: [{ balanceDue: { $gt: 0 } }, { paymentMethod: 'credit', balanceDue: { $exists: false } }],
};
const BALANCE_EXPR = { $ifNull: ['$balanceDue', '$totalAmount'] };

const refreshStatus = (sale) => {
  sale.amountPaid = round2(sale.amountPaid);
  sale.pendingChequeAmount = round2(sale.pendingChequeAmount);
  sale.balanceDue = round2(sale.balanceDue);
  if (sale.balanceDue <= 0 && sale.pendingChequeAmount <= 0) sale.paymentStatus = 'paid';
  else if (sale.balanceDue <= 0) sale.paymentStatus = 'cheque_pending';
  else if (sale.amountPaid > 0 || sale.pendingChequeAmount > 0) sale.paymentStatus = 'partial';
  else sale.paymentStatus = 'unpaid';
};

module.exports = { round2, OPEN_BILL_MATCH, BALANCE_EXPR, refreshStatus };
