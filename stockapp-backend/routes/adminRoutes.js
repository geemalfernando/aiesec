// routes/adminRoutes.js
const express = require('express');
const {
  getUsers,
  updateUserRole,
  deleteUser,
  // getInventory is likely in inventoryRoutes, not here if split
  addInventoryItem,
} = require('../controllers/adminController');

// Import inventory controller functions for transfers and location listing
const {
  transferInventory,
  getAllInventory, // Changed from getInventory for clarity if it fetches all
  addItemToStock, // From inventory controller
  getLocations
} = require('../controllers/inventoryController');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);
router.use(authorize('admin'));

// --- User Management Routes ---
router.get('/users', getUsers);
router.put('/users/:userId/role', updateUserRole);
router.delete('/users/:userId', deleteUser);

// --- Inventory Management Routes ---
// GET /api/admin/inventory - Get all inventory items across all locations
router.get('/inventory', getAllInventory);

// POST /api/admin/inventory - Add a new item to stock (specify location)
router.post('/inventory', addInventoryItem); // Using addItemToStock logic from inventoryController

// POST /api/admin/inventory/transfer - Move inventory between locations
router.post('/inventory/transfer', transferInventory);

// GET /api/admin/inventory/locations - Get list of valid locations
router.get('/inventory/locations', getLocations);

// Note: If you have a specific route for inventory by location (e.g., GET /api/admin/inventory/:location)
// you'd add it here, or preferably under a general /api/inventory router if it's not admin-specific.

module.exports = router;