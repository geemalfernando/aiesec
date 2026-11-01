// models/Payment.js
const mongoose = require('mongoose');

const AllocationSchema = new mongoose.Schema({
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
  amount: { type: Number, required: true, min: 0.01 },
}, { _id: false });

const PaymentSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  method: { type: String, enum: ['cash', 'cheque'], required: true },
  amount: { type: Number, required: true, min: 0.01 },
  allocations: { type: [AllocationSchema], default: [] },
  // Cheque details (method === 'cheque' only)
  chequeNumber: { type: String, trim: true },
  bankName: { type: String, trim: true },
  chequeDate: { type: Date }, // The day it may be deposited
  chequeStatus: { type: String, enum: ['pending', 'deposited', 'cleared', 'bounced'] },
  depositedAt: { type: Date },
  clearedAt: { type: Date },
  bouncedAt: { type: Date },
  bounceReason: { type: String, trim: true, maxlength: 200 },
}, {
  timestamps: true
});

PaymentSchema.index({ method: 1, chequeStatus: 1, chequeDate: 1 });
// The same cheque cannot be recorded twice, but a bounced cheque may be presented again.
PaymentSchema.index(
  { bankName: 1, chequeNumber: 1 },
  { unique: true, partialFilterExpression: { chequeStatus: { $in: ['pending', 'deposited', 'cleared'] } } }
);

module.exports = mongoose.model('Payment', PaymentSchema);
