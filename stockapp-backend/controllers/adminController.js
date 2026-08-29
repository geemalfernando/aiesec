// controllers/adminController.js
const User = require('../models/User'); // Your User model
const InventoryItem = require('../models/InventoryItem'); // The new InventoryItem model

// --- User Management Controllers ---

/**
 * @desc    Get all users
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res, next) => {
  try {
    // Fetch all users, excluding their password for security.
    // You might want to exclude the current logged-in admin: { _id: { $ne: req.user.id } }
    const users = await User.find().select('-password');

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error); // Pass error to the global error handler
  }
};

/**
 * @desc    Update a user's role
 * @route   PUT /api/admin/users/:userId/role
 * @access  Private/Admin
 */
exports.updateUserRole = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Basic validation for the role input
    if (!['user', 'admin'].includes(role)) {
      const error = new Error('Invalid role provided. Allowed roles are "user" and "admin".');
      error.statusCode = 400;
      return next(error);
    }

    // Prevent an admin from modifying their own role via this specific endpoint (optional but good practice)
    if (userId === req.user.id) {
      const error = new Error('Admins cannot modify their own role via this endpoint.');
      error.statusCode = 403;
      return next(error);
    }

    // Find and update the user's role
    const updatedUser = await User.findByIdAndUpdate(userId, { role }, {
      new: true, // Returns the modified document
      runValidators: true, // Ensures that the schema's validation rules are applied
    });

    if (!updatedUser) {
      const error = new Error(`User with ID ${userId} not found.`);
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    next(error); // Pass to global error handler
  }
};

/**
 * @desc    Delete a user
 * @route   DELETE /api/admin/users/:userId
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Prevent an admin from deleting themselves
    if (userId === req.user.id) {
      const error = new Error('Admins cannot delete themselves.');
      error.statusCode = 403;
      return next(error);
    }

    // Use deleteOne() as remove() is deprecated in Mongoose
    const deletedUserResult = await User.deleteOne({ _id: userId });

    if (deletedUserResult.deletedCount === 0) {
      const error = new Error(`User with ID ${userId} not found.`);
      error.statusCode = 404;
      return next(error);
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully.',
      data: {}, // Typically return an empty object or a success message on successful deletion
    });
  } catch (error) {
    next(error); // Pass to global error handler
  }
};


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
    const { name, price, cases, pieces, piecesPerCase, location } = req.body;

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