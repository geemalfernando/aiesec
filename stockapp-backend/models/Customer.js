// models/Customer.js
const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    maxlength: [100, 'Customer name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email address',
    ],
    sparse: true,
  },
  phone: {
    type: String,
    trim: true,
    // Add regex validation for phone numbers if needed
  },
  customerType: { // Unset on customers created before types existed; those are not restricted
    type: String,
    enum: ['cash', 'credit'],
  },
  creditDays: { // Days allowed to collect a credit bill
    type: Number,
    default: 21,
    min: 0,
  },
}, {
  timestamps: true
});

CustomerSchema.index({ email: 1 }); // Index email for faster lookups

// Pre-save hook to convert empty strings to undefined
CustomerSchema.pre('save', function(next) {
  if (this.email === '' || this.email === null) {
    this.email = undefined;
  }
  if (this.phone === '' || this.phone === null) {
    this.phone = undefined;
  }
  next();
});

module.exports = mongoose.model('Customer', CustomerSchema);