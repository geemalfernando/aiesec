// routes/inventoryRoutes.js
const express = require('express');
const {
  transferInventory,
  getInventoryByLocation,
  getAllInventory,
  getLocations
} = require('../controllers/inventoryController');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

// Users need access to locations and viewing inventory for sales
router.get('/locations', authorize('admin', 'user'), getLocations);
router.get('/', authorize('admin', 'user'), getAllInventory);
router.get('/:location', authorize('admin', 'user'), getInventoryByLocation);

// Only admins can transfer inventory
router.post('/transfer', authorize('admin'), transferInventory);

module.exports = router;