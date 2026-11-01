// routes/customerRoutes.js
const express = require('express');
const {
  getCustomers,
  addCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer, // Ensure this is imported
} = require('../controllers/customerController');


const router = express.Router();


router.get('/', getCustomers);
router.post('/', addCustomer);
router.get('/:customerId', getCustomerById);

router.put('/:customerId', updateCustomer);
router.delete('/:customerId', deleteCustomer);

module.exports = router;