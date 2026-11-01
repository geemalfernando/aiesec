// routes/inventoryRoutes.js
const express = require('express');
const {
  transferInventory,
  getInventoryByLocation,
  getAllInventory,
  getLocations
} = require('../controllers/inventoryController');


const router = express.Router();

// Users need access to locations and viewing inventory for sales
router.get('/locations', getLocations);
router.get('/', getAllInventory);
router.get('/:location', getInventoryByLocation);

// Only admins can transfer inventory
router.post('/transfer', transferInventory);

module.exports = router;