// models/Sale.js
const mongoose = require('mongoose');

const SaleItemSchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  cases: {
    type: Number,
    default: 0,
    min: 0,
  },
  pieces: {
    type: Number,
    default: 0,
    min: 0,
  },
  piecesPerCase: {
    type: Number,
    required: true,
    min: 1,
  },
  mrp: {
    type: Number,
    min: 0,
  },
  priceAtSale: {
    type: Number,
    required: true,
    min: 0,
  },
  locationTakenFrom: { // NEW FIELD: Track the location from which the item was sold
    type: String,
    enum: { // Must match InventoryItem locations
      values: ['storeA', 'storeB', 'lorry1', 'lorry2'],
      message: '{VALUE} is not a valid location',
    },
    required: true,
  }
}, { _id: false });

const SaleSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Sale must be associated with a customer'],
  },
  items: [SaleItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit', 'cheque'],
    required: true,
  },
  dueDate: { // NEW FIELD: Due date for credit sales
    type: Date,
    // Validation for 'required' if paymentMethod is 'credit' will be in controller
  },
  agency: { // Which agency the bill came from, when it arrived as a photo
    type: String,
  },
  billNumber: { // Serial number printed on the paper bill
    type: String,
    trim: true,
  },
  billDate: { // The day on the paper bill, when it differs from the day it was entered
    type: Date,
  },
  amountPaid: { // Cash received plus cheques that have cleared
    type: Number,
    default: 0,
    min: 0,
  },
  pendingChequeAmount: { // Cheques received but not yet cleared
    type: Number,
    default: 0,
    min: 0,
  },
  balanceDue: { // Still to collect from the customer
    type: Number,
    min: 0,
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'cheque_pending', 'paid'],
  },
}, {
  timestamps: true
});

SaleSchema.index({ customer: 1, createdAt: -1 });
SaleSchema.index({ createdAt: -1 });
SaleSchema.index({ paymentMethod: 1, dueDate: 1 }); // For querying credit sales

module.exports = mongoose.model('Sale', SaleSchema);