// routes/dashboardRoutes.js
const express = require('express');
const {
  getSalesData,
  getCreditCustomersSummary,
  getDueAndOverdueBills,
} = require('../controllers/dashboardController');


const router = express.Router();

router.get('/sales-data', getSalesData);
router.get('/credit-customers', getCreditCustomersSummary);
router.get('/due-bills', getDueAndOverdueBills); // This endpoint is for listing due bills, perhaps dashboard controller has specific logic for this

module.exports = router;