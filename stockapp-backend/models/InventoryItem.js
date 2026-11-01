// models/InventoryItem.js
const mongoose = require('mongoose');

const InventoryItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    maxlength: [50, 'Item name cannot be longer than 50 characters'],
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
  },
  mrp: { // Maximum retail price printed on the bill
    type: Number,
    min: [0, 'MRP cannot be negative'],
  },
  costPrice: { // Latest cost per piece from a company order
    type: Number,
    min: [0, 'Cost cannot be negative'],
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
  },
  cases: {
    type: Number,
    default: 0,
    min: [0, 'Cases cannot be negative'],
  },
  pieces: {
    type: Number,
    default: 0,
    min: [0, 'Pieces cannot be negative'],
  },
  piecesPerCase: {
    type: Number,
    required: [true, 'Pieces per case is required'],
    min: [1, 'Pieces per case must be at least 1'],
  },
  location: { // NEW FIELD: To track where the item is stocked
    type: String,
    required: [true, 'Item location is required'],
    enum: { // Define your specific locations here. Adjust as needed.
      values: ['storeA', 'storeB', 'lorry1', 'lorry2'],
      message: '{VALUE} is not a valid location',
    },
    trim: true,
  },
}, {
  timestamps: true
});

InventoryItemSchema.pre('validate', function(next) {
  if (this.cases === undefined || this.cases === null) {
    this.cases = 0;
  }

  if (this.pieces === undefined || this.pieces === null) {
    this.pieces = 0;
  }

  if (this.piecesPerCase && Number.isInteger(this.cases) && Number.isInteger(this.pieces)) {
    this.quantity = (this.cases * this.piecesPerCase) + this.pieces;
  }

  next();
});

InventoryItemSchema.index({ location: 1, name: 1 }); // Index on location and name

module.exports = mongoose.model('InventoryItem', InventoryItemSchema);