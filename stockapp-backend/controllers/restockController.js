// controllers/restockController.js
const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const Restock = require('../models/Restock');
const { parseDay } = require('../utils/businessDate');
const { round2 } = require('../utils/billing');

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A company order received into one location. Adds to stock and creates items that are new.
exports.recordRestock = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { supplierName, billNumber, billDate, location, items } = req.body;
    const name = String(supplierName || '').trim();
    if (!name) throw fail('Enter the company name.');
    if (!InventoryItem.schema.path('location').enumValues.includes(location)) throw fail('Choose a valid location.');
    if (!Array.isArray(items) || items.length === 0) throw fail('Add at least one item.');
    if (billNumber && await Restock.exists({ supplierName: name, billNumber: String(billNumber).trim() }).session(session)) {
      throw fail(`Order ${billNumber} from ${name} has already been entered.`, 409);
    }

    const lines = [];
    let total = 0;
    for (const item of items) {
      const itemName = String(item.name || '').trim();
      const cases = Number(item.cases) || 0;
      const pieces = Number(item.pieces) || 0;
      const piecesPerCase = Number(item.piecesPerCase);
      const costPrice = Number(item.costPrice) || 0;
      if (!itemName) throw fail('Every item needs a name.');
      if (!(piecesPerCase >= 1)) throw fail(`${itemName}: enter pieces per case.`);
      if (cases < 0 || pieces < 0 || costPrice < 0) throw fail(`${itemName}: numbers cannot be negative.`);
      if (cases * piecesPerCase + pieces < 1) throw fail(`${itemName}: enter at least 1 piece.`);

      const namePattern = new RegExp(`^${escapeRegex(itemName)}$`, 'i');
      let stock = await InventoryItem.findOne({ name: namePattern, location }).session(session);
      if (!stock) {
        // The same item elsewhere keeps its selling price and pack size.
        const other = await InventoryItem.findOne({ name: namePattern }).session(session);
        [stock] = await InventoryItem.create([{
          name: other?.name || itemName,
          price: other?.price ?? (Number(item.sellingPrice) > 0 ? Number(item.sellingPrice) : costPrice),
          mrp: other?.mrp,
          quantity: 0,
          cases: 0,
          pieces: 0,
          piecesPerCase: other?.piecesPerCase || piecesPerCase,
          location,
        }], { session });
      }
      // Cases count in the pack size already on record, whatever the order says.
      const quantity = cases * stock.piecesPerCase + pieces;
      stock.quantity += quantity;
      stock.cases = Math.floor(stock.quantity / stock.piecesPerCase);
      stock.pieces = stock.quantity % stock.piecesPerCase;
      if (item.mrp !== undefined && item.mrp !== null && item.mrp !== '') stock.mrp = Number(item.mrp);
      if (costPrice > 0) stock.costPrice = costPrice;
      await stock.save({ session });

      total += quantity * costPrice;
      lines.push({
        itemId: stock._id,
        name: stock.name,
        mrp: stock.mrp,
        costPrice,
        quantity,
        cases: Math.floor(quantity / stock.piecesPerCase),
        pieces: quantity % stock.piecesPerCase,
        piecesPerCase: stock.piecesPerCase,
        free: Boolean(item.free) || costPrice === 0,
      });
    }

    const [restock] = await Restock.create([{
      supplierName: name,
      ...(billNumber && { billNumber: String(billNumber).trim() }),
      ...(billDate && { billDate: parseDay(billDate) }),
      location,
      items: lines,
      totalAmount: round2(total),
    }], { session });

    await session.commitTransaction();
    res.status(201).json({ success: true, data: restock });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

exports.getRestocks = async (req, res, next) => {
  try {
    const restocks = await Restock.find().sort({ billDate: -1, createdAt: -1 }).limit(200).lean();
    res.status(200).json({ success: true, data: restocks });
  } catch (error) {
    next(error);
  }
};
