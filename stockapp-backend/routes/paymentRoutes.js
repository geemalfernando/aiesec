// routes/paymentRoutes.js
const express = require('express');
const { recordPayment, getChequeTracker, updateChequeStatus } = require('../controllers/paymentController');

const router = express.Router();

router.post('/', recordPayment);
router.get('/cheques', getChequeTracker);
router.patch('/cheques/:paymentId/status', updateChequeStatus);

module.exports = router;
