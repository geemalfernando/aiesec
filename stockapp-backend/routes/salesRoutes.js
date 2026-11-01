// routes/salesRoutes.js
const express = require('express');
const {
  recordSale,
  getSales,
  getSaleById,
  getDueBills,     // NEW
  getOverdueBills, // NEW
} = require('../controllers/salesController');


const router = express.Router();

router.post('/entry', recordSale); // Allow users and admins to record sales

// NEW: Endpoints for credit bill summaries (MUST come before /:saleId to avoid route conflict)
router.get('/due-bills', getDueBills);
router.get('/overdue-bills', getOverdueBills);

// Admin/manager specific routes for viewing sales history and bills
router.get('/history', getSales); // Allow users to view sales history
router.get('/:saleId', getSaleById);

module.exports = router;