// models/BillPhoto.js
// Photos uploaded through the stockapp-photo-collector app, in the same database.
const mongoose = require('mongoose');

const BillPhotoSchema = new mongoose.Schema({
  agency: { type: String, required: true },
  billDate: { type: String, required: true },
  image: { type: Buffer, required: true },
  size: { type: Number },
  sha256: { type: String },
  status: { type: String, enum: ['pending', 'done', 'skipped'], default: 'pending' },
  uploadedAt: { type: Date, default: Date.now },
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
}, { collection: 'billphotos', autoIndex: false });

module.exports = mongoose.model('BillPhoto', BillPhotoSchema);
