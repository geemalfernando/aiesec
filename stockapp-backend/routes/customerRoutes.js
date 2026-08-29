// routes/customerRoutes.js
const express = require('express');
const {
  getCustomers,
  addCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer, // Ensure this is imported
} = require('../controllers/customerController');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// Users need to view and add customers for sales
router.get('/', authorize('admin', 'user'), getCustomers);
router.post('/', authorize('admin', 'user'), addCustomer);
router.get('/:customerId', authorize('admin', 'user'), getCustomerById);

// Only admins can update or delete customers
router.put('/:customerId', authorize('admin'), updateCustomer);
router.delete('/:customerId', authorize('admin'), deleteCustomer);

module.exports = router;