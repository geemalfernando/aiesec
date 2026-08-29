// routes/dashboardRoutes.js
const express = require('express');
const {
  getSalesData,
  getCreditCustomersSummary,
  getDueAndOverdueBills,
} = require('../controllers/dashboardController');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);
router.use(authorize('admin', 'user')); // Dashboard accessible to admins and users

router.get('/sales-data', getSalesData);
router.get('/credit-customers', getCreditCustomersSummary);
router.get('/due-bills', getDueAndOverdueBills); // This endpoint is for listing due bills, perhaps dashboard controller has specific logic for this

module.exports = router;