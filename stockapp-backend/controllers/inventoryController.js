// controllers/inventoryController.js
const InventoryItem = require('../models/InventoryItem');
const mongoose = require('mongoose');


// Get list of valid locations from schema enum
exports.getLocations = async (req, res, next) => {
    try {
        const locations = InventoryItem.schema.path('location').enumValues;
        res.status(200).json({ success: true, data: locations });
    } catch (error) {
        next(error);
    }
};

// Get inventory for a specific location
exports.getInventoryByLocation = async (req, res, next) => {
  try {
    const { location } = req.params;
    if (!location) {
        const error = new Error('Location parameter is required.'); error.statusCode = 400; return next(error);
    }
    // Ensure location is valid using the enum values
    const validLocations = InventoryItem.schema.path('location').enumValues;
    if (!validLocations.includes(location)) {
        const error = new Error(`Invalid location provided. Valid locations are: ${validLocations.join(', ')}`);
        error.statusCode = 400;
        return next(error);
    }

    const items = await InventoryItem.find({ location: location });
    res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    next(error);
  }
};

// Get all inventory items (across all locations)
exports.getAllInventory = async (req, res, next) => {
    try {
        const items = await InventoryItem.find();
        res.status(200).json({ success: true, count: items.length, data: items });
      } catch (error) {
        next(error);
      }
};

// Add item to stock (can specify location)
// NOTE: This logic is usually handled by adminController.addInventoryItem in the previous examples.
// If you intend to use this controller for adding items, ensure it's consistent.
// For now, assuming addInventoryItem in adminController handles it with location.
// If you want a separate "add item" flow for inventory management, this is where it belongs.
// Example:
/*
exports.addItemToStock = async (req, res, next) => {
  try {
    const { name, price, quantity, location } = req.body;
    // ... validation ...
    const newItem = await InventoryItem.create({ name, price, quantity, location });
    res.status(201).json({ success: true, data: newItem });
  } catch (error) { // ... error handling ... }
};
*/


// Transfer inventory between locations
exports.transferInventory = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { itemId, fromLocation, toLocation, quantity } = req.body;

    // --- Validations ---
    if (!itemId || !fromLocation || !toLocation || quantity === undefined || quantity < 1) {
      const error = new Error('Missing required fields: itemId, fromLocation, toLocation, quantity.');
      error.statusCode = 400; throw error;
    }
    const validLocations = InventoryItem.schema.path('location').enumValues;
    if (!validLocations.includes(fromLocation) || !validLocations.includes(toLocation)) {
        const error = new Error(`Invalid location provided. Valid locations are: ${validLocations.join(', ')}`);
        error.statusCode = 400; throw error;
    }
    if (fromLocation === toLocation) {
        const error = new Error('Source and destination locations cannot be the same.');
        error.statusCode = 400; throw error;
    }

    // --- Find and Deduct from Source Location ---
    const sourceItem = await InventoryItem.findOne({ _id: itemId, location: fromLocation }).session(session);
    if (!sourceItem) {
      const error = new Error(`Item not found at source location "${fromLocation}".`);
      error.statusCode = 404; throw error;
    }
    if (sourceItem.quantity < quantity) {
      const error = new Error(`Insufficient stock at "${fromLocation}" for item "${sourceItem.name}". Available: ${sourceItem.quantity}, Requested: ${quantity}`);
      error.statusCode = 400; throw error;
    }
    sourceItem.quantity -= quantity;
    await sourceItem.save({ session });

    // --- Find or Add to Destination Location ---
    // Look for an item with the same name at the destination location
    let destinationItem = await InventoryItem.findOne({ name: sourceItem.name, location: toLocation }).session(session);
    if (destinationItem) {
      destinationItem.quantity += quantity;
      if (destinationItem.piecesPerCase !== sourceItem.piecesPerCase) {
        const error = new Error(`Cannot transfer item "${sourceItem.name}" because pieces per case does not match at destination.`);
        error.statusCode = 400; throw error;
      }
      destinationItem.cases = Math.floor(destinationItem.quantity / destinationItem.piecesPerCase);
      destinationItem.pieces = destinationItem.quantity % destinationItem.piecesPerCase;
      await destinationItem.save({ session });
    } else {
      // Create new entry at destination location with new ID
      destinationItem = await InventoryItem.create([{
        name: sourceItem.name,
        price: sourceItem.price,
        quantity: quantity,
        cases: Math.floor(quantity / sourceItem.piecesPerCase),
        pieces: quantity % sourceItem.piecesPerCase,
        piecesPerCase: sourceItem.piecesPerCase,
        location: toLocation,
      }], { session });
      destinationItem = destinationItem[0]; // Extract from array returned by create with session
    }

    sourceItem.cases = Math.floor(sourceItem.quantity / sourceItem.piecesPerCase);
    sourceItem.pieces = sourceItem.quantity % sourceItem.piecesPerCase;
    await sourceItem.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Inventory transferred successfully',
      data: {
        itemId: itemId,
        fromLocation: {
          location: fromLocation,
          quantity: sourceItem.quantity
        },
        toLocation: {
          location: toLocation,
          quantity: destinationItem.quantity
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};