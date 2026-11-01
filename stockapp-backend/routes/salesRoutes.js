// routes/salesRoutes.js
const express = require('express');
const {
  recordSale,
  getSales,
  getSaleById,
  saveSaleImage,
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
router.post('/:saleId/image', express.raw({ type: 'image/*', limit: '25mb' }), saveSaleImage);
router.get('/:saleId', getSaleById);

module.exports = router;