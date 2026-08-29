// controllers/customerController.js
const Customer = require('../models/Customer');

exports.getCustomers = async (req, res, next) => {
  try {
    // Add filtering based on role if needed (e.g., only admins see all, users see their own)
    const customers = await Customer.find();
    res.status(200).json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    next(error);
  }
};

exports.addCustomer = async (req, res, next) => {
  try {
    let { name, email, phone } = req.body;

    if (!name) {
      const error = new Error('Customer name is required.');
      error.statusCode = 400;
      return next(error);
    }

    // Convert empty strings to undefined to avoid unique constraint issues
    if (email === '' || email === null) email = undefined;
    if (phone === '' || phone === null) phone = undefined;

    // Check if customer with the same email already exists (if email is provided and unique)
    if (email) {
      const existingCustomer = await Customer.findOne({ email });
      if (existingCustomer) {
        const error = new Error('Customer with this email already exists.');
        error.statusCode = 409; // Conflict
        return next(error);
      }
    }

    const newCustomer = await Customer.create({ name, email, phone });
    res.status(201).json({
      success: true,
      data: newCustomer,
    });
  } catch (error) {
    next(error);
  }
};

exports.getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.customerId);

    if (!customer) {
      const error = new Error(`Customer with ID ${req.params.customerId} not found.`);
      error.statusCode = 404;
      return next(error);
    }
    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    let { name, email, phone } = req.body;

    if (!name) {
      const error = new Error('Customer name is required.');
      error.statusCode = 400;
      return next(error);
    }

    // Convert empty strings to undefined to avoid unique constraint issues
    if (email === '' || email === null) email = undefined;
    if (phone === '' || phone === null) phone = undefined;

    if (email) {
      const existingCustomer = await Customer.findOne({ email, _id: { $ne: customerId } });
      if (existingCustomer) {
        const error = new Error('Another customer already exists with this email.');
        error.statusCode = 409; // Conflict
        return next(error);
      }
    }

    const updateData = { name };
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;

    const updatedCustomer = await Customer.findByIdAndUpdate(customerId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedCustomer) {
      const error = new Error(`Customer with ID ${customerId} not found.`);
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      data: updatedCustomer,
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    // Optional: Add checks for existing sales before deleting customer.

    const deletedCustomer = await Customer.findByIdAndDelete(customerId);

    if (!deletedCustomer) {
      const error = new Error(`Customer with ID ${customerId} not found.`);
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'Customer deleted successfully.',
      data: {},
    });
  } catch (error) {
    next(error);
  }
};