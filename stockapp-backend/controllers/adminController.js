// controllers/adminController.js
const InventoryItem = require('../models/InventoryItem'); // The new InventoryItem model

// --- Inventory Management Controllers ---

/**
 * @desc    Get all inventory items
 * @route   GET /api/admin/inventory
 * @access  Private/Admin
 */
exports.getInventory = async (req, res, next) => {
  try {
    const items = await InventoryItem.find(); // Fetch all items from InventoryItem collection
    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add a new inventory item
 * @route   POST /api/admin/inventory
 * @access  Private/Admin
 */
exports.addInventoryItem = async (req, res, next) => {
  try {
    const { name, price, mrp, cases, pieces, piecesPerCase, location } = req.body;

    // Basic server-side validation (Mongoose schema validation will also be applied)
    if (!name || price === undefined || cases === undefined || pieces === undefined || piecesPerCase === undefined || !location) {
      const error = new Error('Please provide name, price, cases, pieces, pieces per case, and location for the item.');
      error.statusCode = 400;
      return next(error);
    }

    // Validate price and stock counts
    if (price < 0) {
      const error = new Error('Price must be a positive number.');
      error.statusCode = 400;
      return next(error);
    }

    if (cases < 0 || !Number.isInteger(cases)) {
      const error = new Error('Cases must be a non-negative integer.');
      error.statusCode = 400;
      return next(error);
    }

    if (pieces < 0 || !Number.isInteger(pieces)) {
      const error = new Error('Pieces must be a non-negative integer.');
      error.statusCode = 400;
      return next(error);
    }

    if (piecesPerCase < 1 || !Number.isInteger(piecesPerCase)) {
      const error = new Error('Pieces per case must be an integer greater than 0.');
      error.statusCode = 400;
      return next(error);
    }

    // Validate location exists in enum
    const validLocations = InventoryItem.schema.path('location').enumValues;
    if (!validLocations.includes(location)) {
      const error = new Error(`Invalid location. Valid locations are: ${validLocations.join(', ')}`);
      error.statusCode = 400;
      return next(error);
    }

    // Create a new inventory item
    const newItem = await InventoryItem.create({
      name,
      price,
      mrp,
      cases,
      pieces,
      piecesPerCase,
      location,
    });

    // Respond with 201 Created status code
    res.status(201).json({
      success: true,
      data: newItem,
    });
  } catch (error) {
    // Handle specific Mongoose validation errors
    if (error.name === 'ValidationError') {
      // Extract validation error messages
      const messages = Object.values(error.errors).map(val => val.message);
      const validationError = new Error(messages.join(', '));
      validationError.statusCode = 400; // Bad Request
      return next(validationError);
    }
    next(error); // Pass other errors to the global handler
  }
};

// You can add controllers for updateInventoryItem and deleteInventoryItem here later.