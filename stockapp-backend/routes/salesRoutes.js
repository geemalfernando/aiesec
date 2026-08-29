// routes/salesRoutes.js
const express = require('express');
const {
  recordSale,
  getSales,
  getSaleById,
  getDueBills,     // NEW
  getOverdueBills, // NEW
} = require('../controllers/salesController');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

// User roles might differ for these actions
router.post('/entry', authorize('user', 'admin'), recordSale); // Allow users and admins to record sales

// NEW: Endpoints for credit bill summaries (MUST come before /:saleId to avoid route conflict)
router.get('/due-bills', authorize('admin', 'user'), getDueBills);
router.get('/overdue-bills', authorize('admin', 'user'), getOverdueBills);

// Admin/manager specific routes for viewing sales history and bills
router.get('/history', authorize('admin', 'user'), getSales); // Allow users to view sales history
router.get('/:saleId', authorize('admin', 'user'), getSaleById);

module.exports = router;