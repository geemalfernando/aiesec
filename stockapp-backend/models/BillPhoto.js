// models/BillPhoto.js
// Photos uploaded through the stockapp-photo-collector app, in the same database.
const mongoose = require('mongoose');

const BillPhotoSchema = new mongoose.Schema({
  agency: { type: String, required: true },
  billDate: { type: String, required: true },
  image: { type: Buffer, required: true },
  size: { type: Number },
  sha256: { type: String },
  status: { type: String, enum: ['awaiting_approval', 'pending', 'done', 'skipped', 'rejected'], default: 'pending' },
  uploadedAt: { type: Date, default: Date.now },
  takenAt: { type: Date }, // From the phone's clock, so for information only
  late: { type: Boolean, default: false }, // Sent after midnight of its bill date
  decidedAt: { type: Date },
  savedPath: { type: String },
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
}, { collection: 'billphotos', autoIndex: false });

module.exports = mongoose.model('BillPhoto', BillPhotoSchema);
