// controllers/salesController.js
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const InventoryItem = require('../models/InventoryItem');
const Payment = require('../models/Payment');
const { chequeFields } = require('./paymentController');
const { today, addDays, parseDay } = require('../utils/businessDate');
const { OPEN_BILL_MATCH, BALANCE_EXPR, refreshStatus } = require('../utils/billing');
const mongoose = require('mongoose');

// A bill records what already happened, so its lines may create new stock items
// (saved with their MRP) or add the stock the system was missing.
const prepareBillLines = async (items, session) => {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (!item.newItem) continue;
    const name = String(item.name || '').trim();
    if (!name || !item.locationTakenFrom) {
      const error = new Error('Each new item needs a name and a location.');
      error.statusCode = 400; throw error;
    }
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let stock = await InventoryItem.findOne({ name: new RegExp(`^${escaped}$`, 'i'), location: item.locationTakenFrom }).session(session);
    if (!stock) {
      [stock] = await InventoryItem.create([{
        name,
        price: item.priceAtSale > 0 ? item.priceAtSale : 0,
        mrp: item.mrp ?? undefined,
        quantity: 0,
        cases: 0,
        pieces: 0,
        piecesPerCase: item.piecesPerCase,
        location: item.locationTakenFrom,
      }], { session });
    }
    item.itemId = String(stock._id);
    if (item.priceAtSale > 0 && stock.price === 0) {
      stock.price = item.priceAtSale;
      await stock.save({ session });
    }
  }

  const needed = new Map();
  items.filter((item) => item.topUp).forEach((item) => {
    const quantity = item.cases * item.piecesPerCase + item.pieces;
    needed.set(item.itemId, (needed.get(item.itemId) || 0) + quantity);
  });
  for (const [itemId, quantity] of needed) {
    const stock = await InventoryItem.findById(itemId).session(session);
    if (stock && stock.quantity < quantity) {
      stock.quantity = quantity;
      stock.cases = Math.floor(quantity / stock.piecesPerCase);
      stock.pieces = quantity % stock.piecesPerCase;
      await stock.save({ session });
    }
  }
};

exports.recordSale = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customerId, items, discountAmount, discountPercentage, paymentMethod, dueDate, cheque, billNumber, billDate } = req.body;

    // --- Input Validation ---
    if (!customerId || !items || !Array.isArray(items) || items.length === 0 || !paymentMethod) {
      const error = new Error('Missing required fields: customer, items, or payment method.');
      error.statusCode = 400; throw error;
    }
    const chequeData = paymentMethod === 'cheque' ? chequeFields(cheque || {}) : null;

    // --- Customer Validation ---
    const customer = await Customer.findById(customerId).session(session);
    if (!customer) {
      const error = new Error(`Customer with ID ${customerId} not found.`);
      error.statusCode = 404; throw error;
    }
    if (paymentMethod === 'credit' && customer.customerType === 'cash') {
      const error = new Error(`${customer.name} is a cash customer and cannot buy on credit.`);
      error.statusCode = 400; throw error;
    }

    if (billNumber && await Sale.exists({ billNumber: String(billNumber).trim() }).session(session)) {
      const error = new Error(`Bill ${billNumber} has already been entered.`);
      error.statusCode = 409; throw error;
    }

    await prepareBillLines(items, session);

    // --- Item Validation and Price Calculation ---
    let calculatedTotalAmount = 0;
    const saleItemsData = [];

    for (const item of items) {
      const { itemId, cases, pieces, piecesPerCase, locationTakenFrom, priceAtSale } = item;
      const quantity = (cases * piecesPerCase) + pieces;

      if (!itemId || cases === undefined || pieces === undefined || piecesPerCase === undefined || quantity < 1 || !locationTakenFrom) {
        const error = new Error('Invalid item data in sale items. Each item must have itemId, cases, pieces, pieces per case, and locationTakenFrom.');
        error.statusCode = 400; throw error;
      }

      if (!Number.isInteger(cases) || cases < 0 || !Number.isInteger(pieces) || pieces < 0 || !Number.isInteger(piecesPerCase) || piecesPerCase < 1) {
        const error = new Error('Cases, pieces, and pieces per case must be valid integers.');
        error.statusCode = 400; throw error;
      }

      if (pieces >= piecesPerCase) {
        const error = new Error('Pieces must be less than pieces per case.');
        error.statusCode = 400; throw error;
      }

      // Find the item at the specified location
      const inventoryItem = await InventoryItem.findOne({ _id: itemId, location: locationTakenFrom }).session(session);
      if (!inventoryItem) {
        const error = new Error(`Item with ID ${itemId} not found at location "${locationTakenFrom}".`);
        error.statusCode = 404; throw error;
      }
      if (inventoryItem.quantity < quantity) {
        const error = new Error(`Insufficient stock at "${locationTakenFrom}" for item "${inventoryItem.name}". Available: ${inventoryItem.quantity}, Requested: ${quantity}`);
        error.statusCode = 400; throw error;
      }

      // The rate on the bill can differ from the stock price, and free items are 0.
      const itemPrice = Number.isFinite(priceAtSale) && priceAtSale >= 0 ? priceAtSale : inventoryItem.price;
      const itemSubtotal = itemPrice * quantity;

      if (item.mrp !== undefined && item.mrp !== null && item.mrp !== inventoryItem.mrp) {
        inventoryItem.mrp = item.mrp;
        await inventoryItem.save({ session });
      }

      saleItemsData.push({
        mrp: inventoryItem.mrp,
        itemId: itemId,
        name: inventoryItem.name,
        quantity: quantity,
        cases: cases,
        pieces: pieces,
        piecesPerCase: piecesPerCase,
        priceAtSale: itemPrice,
        locationTakenFrom: locationTakenFrom, // Save location
      });
      calculatedTotalAmount += itemSubtotal;
    }

    // --- Apply Discounts ---
    let finalTotal = calculatedTotalAmount;
    if (discountPercentage > 0) { const discountValue = (calculatedTotalAmount * discountPercentage) / 100; finalTotal = calculatedTotalAmount - discountValue; }
    else if (discountAmount > 0) { finalTotal = calculatedTotalAmount - discountAmount; }
    finalTotal = Math.max(0, finalTotal);

    // --- Update Inventory Stock ---
    // One at a time: a sale can have the same stock twice, as a paid and a free line.
    for (const item of items) {
      const soldQuantity = (item.cases * item.piecesPerCase) + item.pieces;
      const inventoryItem = await InventoryItem.findOne({ _id: item.itemId, location: item.locationTakenFrom }).session(session);

      if (!inventoryItem) {
        const error = new Error(`Item with ID ${item.itemId} not found at location "${item.locationTakenFrom}".`);
        error.statusCode = 404; throw error;
      }

      if (inventoryItem.quantity < soldQuantity) {
        const error = new Error(`Insufficient stock at "${item.locationTakenFrom}" for item "${inventoryItem.name}". Available: ${inventoryItem.quantity}, Requested: ${soldQuantity}`);
        error.statusCode = 400; throw error;
      }
      inventoryItem.quantity -= soldQuantity;
      inventoryItem.cases = Math.floor(inventoryItem.quantity / inventoryItem.piecesPerCase);
      inventoryItem.pieces = inventoryItem.quantity % inventoryItem.piecesPerCase;
      await inventoryItem.save({ session });
    }

    // --- Create the sale record ---
    const billDueDate = paymentMethod === 'credit'
      ? (dueDate ? parseDay(dueDate) : addDays(billDate ? parseDay(billDate) : today(), customer.creditDays))
      : chequeData?.chequeDate; // If a sale's cheque bounces, the bill is already due
    const newSale = await Sale.create([{
      customer: customerId,
      items: saleItemsData,
      totalAmount: finalTotal,
      discountAmount: discountAmount || 0,
      discountPercentage: discountPercentage || 0,
      paymentMethod: paymentMethod,
      dueDate: billDueDate,
      ...(billNumber && { billNumber: String(billNumber).trim() }),
      ...(billDate && { billDate: parseDay(billDate) }),
      amountPaid: paymentMethod === 'cash' ? finalTotal : 0,
      pendingChequeAmount: paymentMethod === 'cheque' ? finalTotal : 0,
      balanceDue: paymentMethod === 'credit' ? finalTotal : 0,
    }], { session: session });

    refreshStatus(newSale[0]);
    await newSale[0].save({ session });

    if (chequeData) {
      if (!(finalTotal > 0)) {
        const error = new Error('A cheque sale must have an amount above zero.');
        error.statusCode = 400; throw error;
      }
      await Payment.create([{
        customer: customerId,
        method: 'cheque',
        amount: finalTotal,
        allocations: [{ sale: newSale[0]._id, amount: finalTotal }],
        ...chequeData,
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ success: true, message: 'Sale recorded successfully.', data: newSale[0] });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error.code === 11000 ? Object.assign(new Error('This cheque number is already recorded for this bank.'), { statusCode: 409 }) : error);
  }
};

// Get all sales (sales history)
exports.getSales = async (req, res, next) => {
  try {
    let query = Sale.find()
      .populate('customer', 'name email phone')
      .populate('items.itemId', 'name price')
      .sort({ createdAt: -1 });

    // Filtering based on query params (e.g., ?customerId=..., ?paymentMethod=...)
    if (req.query.customerId) query = query.where('customer').equals(req.query.customerId);
    if (req.query.paymentMethod) query = query.where('paymentMethod').equals(req.query.paymentMethod);
    
    // Date filtering
    if (req.query.startDate || req.query.endDate) {
      const dateFilter = {};
      if (req.query.startDate) {
        dateFilter.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        dateFilter.$lte = new Date(req.query.endDate);
      }
      query = query.where('createdAt').gte(dateFilter.$gte || new Date(0)).lte(dateFilter.$lte || new Date());
    }

    const sales = await query.exec();
    
    // Transform data to match requirements format
    const transformedSales = sales.map(sale => ({
      _id: sale._id,
      customerId: sale.customer._id,
      customerName: sale.customer.name,
      items: sale.items,
      subtotal: sale.totalAmount + sale.discountAmount,
      discountAmount: sale.discountAmount,
      discountPercentage: sale.discountPercentage,
      totalAmount: sale.totalAmount,
      paymentMethod: sale.paymentMethod,
      dueDate: sale.dueDate,
      amountPaid: sale.amountPaid,
      pendingChequeAmount: sale.pendingChequeAmount,
      balanceDue: sale.balanceDue ?? (sale.paymentMethod === 'credit' ? sale.totalAmount : 0),
      paymentStatus: sale.paymentStatus,
      saleDate: sale.billDate || sale.createdAt,
      billNumber: sale.billNumber,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt
    }));
    
    res.status(200).json({ success: true, count: transformedSales.length, data: transformedSales });
  } catch (error) {
    next(error);
  }
};

// Get a single sale by ID
exports.getSaleById = async (req, res, next) => {
  try {
    const sale = await Sale.findById(req.params.saleId)
      .populate('customer', 'name email phone')
      .populate('items.itemId', 'name price')
      .exec();

    if (!sale) {
      const error = new Error(`Sale with ID ${req.params.saleId} not found.`);
      error.statusCode = 404; return next(error);
    }
    res.status(200).json({ success: true, data: sale });
  } catch (error) {
    next(error);
  }
};

// --- Credit Bill Specific Endpoints ---

// Get list of due bills (for user dashboard or admin)
exports.getDueBills = async (req, res, next) => {
    try {
        const now = today();

        const dueBills = await Sale.aggregate([
            { $match: { ...OPEN_BILL_MATCH, dueDate: { $gte: now } } }, // Due today or in the future
            { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'customerInfo' } },
            { $unwind: '$customerInfo' },
            { $project: { // Select only needed fields
                _id: 1, 
                customerId: '$customer',
                totalAmount: 1, 
                balanceDue: BALANCE_EXPR,
                dueDate: 1, 
                createdAt: 1,
                saleDate: { $ifNull: ['$billDate', '$createdAt'] },
                billNumber: 1,
                customerName: '$customerInfo.name'
            }},
            { $sort: { dueDate: 1 } }
        ]);

        res.status(200).json({ success: true, data: dueBills });
    } catch (error) {
        next(error);
    }
};

// Get list of overdue credit bills
exports.getOverdueBills = async (req, res, next) => {
    try {
        const now = today();

        const overdueBills = await Sale.aggregate([
            { $match: { ...OPEN_BILL_MATCH, dueDate: { $lt: now } } }, // Due before today
            { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'customerInfo' } },
            { $unwind: '$customerInfo' },
            { $project: {
                _id: 1, 
                customerId: '$customer',
                totalAmount: 1, 
                balanceDue: BALANCE_EXPR,
                dueDate: 1, 
                createdAt: 1,
                saleDate: { $ifNull: ['$billDate', '$createdAt'] },
                billNumber: 1,
                customerName: '$customerInfo.name'
            }},
            { $sort: { dueDate: 1 } }
        ]);

        res.status(200).json({ success: true, data: overdueBills });
    } catch (error) {
        next(error);
    }
};