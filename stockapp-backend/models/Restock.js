// models/Restock.js
const mongoose = require('mongoose');

const RestockItemSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  name: { type: String, required: true },
  mrp: { type: Number, min: 0 },
  costPrice: { type: Number, default: 0, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  cases: { type: Number, default: 0, min: 0 },
  pieces: { type: Number, default: 0, min: 0 },
  piecesPerCase: { type: Number, required: true, min: 1 },
  free: { type: Boolean, default: false },
}, { _id: false });

const RestockSchema = new mongoose.Schema({
  supplierName: { type: String, required: true, trim: true },
  billNumber: { type: String, trim: true },
  billDate: { type: Date },
  imagePath: { type: String },
  location: { type: String, required: true },
  items: [RestockItemSchema],
  totalAmount: { type: Number, default: 0, min: 0 },
}, {
  timestamps: true
});

RestockSchema.index({ supplierName: 1, billNumber: 1 });
RestockSchema.index({ 'items.name': 1 });

module.exports = mongoose.model('Restock', RestockSchema);
