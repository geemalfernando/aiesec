// routes/reportRoutes.js
const express = require('express');
const { getOrderForecast, getCustomerSummaries, getCustomerReport, getItemSummaries, getItemReport, updateItem, setStockCount } = require('../controllers/reportController');

const router = express.Router();

router.get('/customers', getCustomerSummaries);
router.get('/customers/:customerId', getCustomerReport);
router.get('/forecast', getOrderForecast);
router.get('/items', getItemSummaries);
router.get('/items/:name', getItemReport);
router.patch('/items/:name', updateItem);
router.patch('/stock/:stockId/count', setStockCount);

module.exports = router;
