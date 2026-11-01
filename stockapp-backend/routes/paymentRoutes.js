// routes/paymentRoutes.js
const express = require('express');
const { recordPayment, getChequeTracker, updateChequeStatus } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

router.post('/', authorize('admin', 'user'), recordPayment);
router.get('/cheques', authorize('admin', 'user'), getChequeTracker);
router.patch('/cheques/:paymentId/status', authorize('admin'), updateChequeStatus);

module.exports = router;
