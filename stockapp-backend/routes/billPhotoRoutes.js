// routes/billPhotoRoutes.js
const express = require('express');
const mongoose = require('mongoose');
const BillPhoto = require('../models/BillPhoto');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { status = 'pending', agency } = req.query;
    const filter = { status: String(status), ...(agency && { agency: String(agency) }) };
    const [photos, counts] = await Promise.all([
      BillPhoto.find(filter).select('-image -sha256').sort({ billDate: 1, uploadedAt: 1 }).limit(200).lean(),
      BillPhoto.aggregate([{ $group: { _id: { agency: '$agency', status: '$status' }, count: { $sum: 1 }, bytes: { $sum: '$size' } } }]),
    ]);
    res.status(200).json({ success: true, data: photos, counts: counts.map((row) => ({ ...row._id, count: row.count, bytes: row.bytes })) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/image', async (req, res, next) => {
  try {
    const photo = mongoose.isValidObjectId(req.params.id) ? await BillPhoto.findById(req.params.id).select('image') : null;
    if (!photo) throw Object.assign(new Error('Photo not found.'), { statusCode: 404 });
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400' });
    res.send(photo.image);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'skipped'].includes(status)) throw Object.assign(new Error('Invalid status.'), { statusCode: 400 });
    const photo = mongoose.isValidObjectId(req.params.id) ? await BillPhoto.findOneAndUpdate({ _id: req.params.id, status: { $ne: 'done' } }, { status }, { new: true }).select('-image -sha256') : null;
    if (!photo) throw Object.assign(new Error('This photo cannot be changed.'), { statusCode: 409 });
    res.status(200).json({ success: true, data: photo });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
