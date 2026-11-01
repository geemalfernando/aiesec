// controllers/reportController.js
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const InventoryItem = require('../models/InventoryItem');
const Payment = require('../models/Payment');
const Restock = require('../models/Restock');
const Sale = require('../models/Sale');
const { forecastItem } = require('../utils/forecast');
const { today } = require('../utils/businessDate');
const { BALANCE_EXPR, OPEN_BILL_MATCH, round2 } = require('../utils/billing');

const TZ = process.env.BUSINESS_TZ || 'Asia/Colombo';
const SALE_DATE = { $ifNull: ['$billDate', '$createdAt'] };
const MONTH = (date) => ({ $dateToString: { format: '%Y-%m', date, timezone: TZ } });
const LINE_TOTAL = { $multiply: ['$items.quantity', '$items.priceAtSale'] };
const ITEM_KEY = { $toLower: '$items.name' };
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Every customer with what they have bought and what they owe.
exports.getCustomerSummaries = async (req, res, next) => {
  try {
    const customers = await Customer.find().sort({ name: 1 }).lean();
    const [sales, open] = await Promise.all([
      Sale.aggregate([{ $group: { _id: '$customer', total: { $sum: '$totalAmount' }, bills: { $sum: 1 }, lastSale: { $max: SALE_DATE } } }]),
      Sale.aggregate([{ $match: OPEN_BILL_MATCH }, { $group: { _id: '$customer', owed: { $sum: BALANCE_EXPR } } }]),
    ]);
    const salesBy = new Map(sales.map((row) => [String(row._id), row]));
    const owedBy = new Map(open.map((row) => [String(row._id), row.owed]));
    res.status(200).json({
      success: true,
      data: customers.map((customer) => {
        const row = salesBy.get(String(customer._id));
        return { ...customer, totalSales: row?.total || 0, bills: row?.bills || 0, lastSale: row?.lastSale || null, owed: owedBy.get(String(customer._id)) || 0 };
      }),
    });
  } catch (error) {
    next(error);
  }
};

exports.getCustomerReport = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    if (!mongoose.isValidObjectId(customerId)) throw Object.assign(new Error('Customer not found.'), { statusCode: 404 });
    const customer = await Customer.findById(customerId).lean();
    if (!customer) throw Object.assign(new Error('Customer not found.'), { statusCode: 404 });
    const id = new mongoose.Types.ObjectId(customerId);

    const [bills, monthly, topItems, cheques] = await Promise.all([
      Sale.aggregate([
        { $match: { customer: id } },
        { $addFields: { saleDate: SALE_DATE, balanceDue: { $cond: [{ $eq: ['$paymentMethod', 'credit'] }, BALANCE_EXPR, { $ifNull: ['$balanceDue', 0] }] } } },
        { $sort: { saleDate: -1 } },
        { $project: { saleDate: 1, billNumber: 1, totalAmount: 1, amountPaid: 1, pendingChequeAmount: 1, balanceDue: 1, paymentMethod: 1, paymentStatus: 1, dueDate: 1, items: 1 } },
      ]),
      Sale.aggregate([
        { $match: { customer: id } },
        { $group: { _id: MONTH(SALE_DATE), total: { $sum: '$totalAmount' } } },
        { $sort: { _id: 1 } },
      ]),
      Sale.aggregate([
        { $match: { customer: id } },
        { $unwind: '$items' },
        { $group: { _id: ITEM_KEY, name: { $first: '$items.name' }, quantity: { $sum: '$items.quantity' }, total: { $sum: LINE_TOTAL } } },
        { $sort: { total: -1, quantity: -1 } },
        { $limit: 8 },
      ]),
      Payment.find({ customer: id, method: 'cheque' }).sort({ chequeDate: -1 }).lean(),
    ]);

    const day = today();
    const open = bills.filter((bill) => bill.balanceDue > 0);
    const total = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    res.status(200).json({
      success: true,
      data: {
        customer,
        summary: {
          totalSales: round2(total),
          billCount: bills.length,
          averageBill: bills.length ? round2(total / bills.length) : 0,
          owed: round2(open.reduce((sum, bill) => sum + bill.balanceDue, 0)),
          overdue: round2(open.filter((bill) => bill.dueDate && new Date(bill.dueDate) < day).reduce((sum, bill) => sum + bill.balanceDue, 0)),
          chequesPending: round2(cheques.filter((c) => ['pending', 'deposited'].includes(c.chequeStatus)).reduce((sum, c) => sum + c.amount, 0)),
          bounced: cheques.filter((c) => c.chequeStatus === 'bounced').length,
          lastSale: bills[0]?.saleDate || null,
        },
        monthly: monthly.map((row) => ({ month: row._id, total: row.total })),
        topItems,
        bills,
        cheques,
      },
    });
  } catch (error) {
    next(error);
  }
};

const totalsByItem = async () => {
  const [sold, received] = await Promise.all([
    Sale.aggregate([{ $unwind: '$items' }, { $group: { _id: ITEM_KEY, quantity: { $sum: '$items.quantity' }, value: { $sum: LINE_TOTAL }, last: { $max: SALE_DATE } } }]),
    Restock.aggregate([{ $unwind: '$items' }, { $group: { _id: ITEM_KEY, quantity: { $sum: '$items.quantity' } } }]),
  ]);
  return { sold: new Map(sold.map((row) => [row._id, row])), received: new Map(received.map((row) => [row._id, row.quantity])) };
};

const groupStock = (records, sold, received) => {
  const groups = new Map();
  records.forEach((record) => {
    const key = record.name.toLowerCase();
    const group = groups.get(key) || { name: record.name, mrp: null, price: record.price, costPrice: null, piecesPerCase: record.piecesPerCase, stock: 0, locations: [] };
    group.stock += record.quantity;
    group.mrp = record.mrp ?? group.mrp;
    group.costPrice = record.costPrice ?? group.costPrice;
    group.locations.push({ _id: record._id, location: record.location, quantity: record.quantity, cases: record.cases, pieces: record.pieces, price: record.price });
    groups.set(key, group);
  });
  return [...groups.entries()].map(([key, group]) => ({
    ...group,
    sold: sold.get(key)?.quantity || 0,
    soldValue: sold.get(key)?.value || 0,
    lastSold: sold.get(key)?.last || null,
    received: received.get(key) || 0,
  }));
};

// One row per item, whichever locations hold it.
exports.getItemSummaries = async (req, res, next) => {
  try {
    const [records, { sold, received }] = await Promise.all([InventoryItem.find().lean(), totalsByItem()]);
    const data = groupStock(records, sold, received).sort((a, b) => a.name.localeCompare(b.name));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getItemReport = async (req, res, next) => {
  try {
    const pattern = new RegExp(`^${escapeRegex(req.params.name)}$`, 'i');
    const records = await InventoryItem.find({ name: pattern }).lean();
    if (records.length === 0) throw Object.assign(new Error('Item not found.'), { statusCode: 404 });

    const [sales, restocks, { sold, received }] = await Promise.all([
      Sale.aggregate([
        { $match: { 'items.name': pattern } },
        { $unwind: '$items' },
        { $match: { 'items.name': pattern } },
        { $lookup: { from: 'customers', localField: 'customer', foreignField: '_id', as: 'buyer' } },
        { $addFields: { date: SALE_DATE, buyer: { $first: '$buyer' } } },
        { $project: { date: 1, billNumber: 1, items: 1, customerId: '$customer', customerName: '$buyer.name' } },
      ]),
      Restock.aggregate([
        { $match: { 'items.name': pattern } },
        { $unwind: '$items' },
        { $match: { 'items.name': pattern } },
        { $addFields: { date: { $ifNull: ['$billDate', '$createdAt'] } } },
        { $project: { date: 1, billNumber: 1, items: 1, supplierName: 1, location: 1 } },
      ]),
      totalsByItem(),
    ]);

    const monthKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).format(date);
    const monthly = new Map();
    const bump = (date, field, quantity) => {
      const key = monthKey(new Date(date));
      const row = monthly.get(key) || { month: key, sold: 0, received: 0 };
      row[field] += quantity;
      monthly.set(key, row);
    };
    const buyers = new Map();
    sales.forEach((row) => {
      bump(row.date, 'sold', row.items.quantity);
      const key = String(row.customerId);
      const buyer = buyers.get(key) || { _id: key, name: row.customerName || 'Unknown', quantity: 0 };
      buyer.quantity += row.items.quantity;
      buyers.set(key, buyer);
    });
    restocks.forEach((row) => bump(row.date, 'received', row.items.quantity));

    const movements = [
      ...sales.map((row) => ({ type: 'sale', date: row.date, ref: row.billNumber, party: row.customerName || 'Unknown', partyId: row.customerId, location: row.items.locationTakenFrom, quantity: row.items.quantity, rate: row.items.priceAtSale })),
      ...restocks.map((row) => ({ type: 'restock', date: row.date, ref: row.billNumber, party: row.supplierName, location: row.location, quantity: row.items.quantity, rate: row.items.costPrice })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      success: true,
      data: {
        item: groupStock(records, sold, received)[0],
        monthly: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
        topCustomers: [...buyers.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8),
        movements,
      },
    });
  } catch (error) {
    next(error);
  }
};

// What to order: one row per item, using the last 26 weeks of sales. Free items count, as they leave stock too.
exports.getOrderForecast = async (req, res, next) => {
  try {
    const clamp = (value, fallback, max) => {
      const number = Number(value);
      return Number.isFinite(number) && number >= 0 ? Math.min(number, max) : fallback;
    };
    const settings = {
      leadDays: clamp(req.query.leadDays, 7, 90),
      coverDays: clamp(req.query.coverDays, 14, 180),
      serviceLevel: [90, 95, 98].includes(Number(req.query.serviceLevel)) ? Number(req.query.serviceLevel) : 95,
    };
    const since = new Date(Date.now() - 26 * 7 * 86400000);
    const [records, lines, restocks, { sold, received }] = await Promise.all([
      InventoryItem.find().lean(),
      Sale.aggregate([
        { $addFields: { date: SALE_DATE } },
        { $match: { date: { $gte: since } } },
        { $unwind: '$items' },
        { $project: { _id: 0, key: ITEM_KEY, date: 1, quantity: '$items.quantity' } },
      ]),
      Restock.aggregate([
        { $sort: { billDate: 1, createdAt: 1 } },
        { $unwind: '$items' },
        { $group: { _id: ITEM_KEY, supplierName: { $last: '$supplierName' } } },
      ]),
      totalsByItem(),
    ]);
    const salesBy = new Map();
    lines.forEach((line) => salesBy.set(line.key, [...(salesBy.get(line.key) || []), line]));
    const supplierBy = new Map(restocks.map((row) => [row._id, row.supplierName]));
    const data = groupStock(records, sold, received).map((item) => {
      const key = item.name.toLowerCase();
      return {
        name: item.name,
        stock: item.stock,
        piecesPerCase: item.piecesPerCase,
        mrp: item.mrp,
        costPrice: item.costPrice,
        supplierName: supplierBy.get(key) || null,
        ...forecastItem({ sales: salesBy.get(key) || [], stock: item.stock, piecesPerCase: item.piecesPerCase, costPrice: item.costPrice, price: item.price }, settings),
      };
    });
    res.status(200).json({ success: true, settings, data });
  } catch (error) {
    next(error);
  }
};

// Edits that apply to the item everywhere: name, MRP, selling price.
exports.updateItem = async (req, res, next) => {
  try {
    const pattern = new RegExp(`^${escapeRegex(req.params.name)}$`, 'i');
    const update = {};
    const { name, mrp, price } = req.body;
    if (name !== undefined) {
      if (!String(name).trim()) throw Object.assign(new Error('Enter a name.'), { statusCode: 400 });
      update.name = String(name).trim();
    }
    if (mrp !== undefined && mrp !== '' && mrp !== null) update.mrp = Number(mrp);
    if (price !== undefined && price !== '') update.price = Number(price);
    if (update.mrp < 0 || update.price < 0) throw Object.assign(new Error('Prices cannot be negative.'), { statusCode: 400 });
    const result = await InventoryItem.updateMany({ name: pattern }, { $set: update }, { runValidators: true });
    if (result.matchedCount === 0) throw Object.assign(new Error('Item not found.'), { statusCode: 404 });
    if (update.name) {
      await Sale.updateMany({ 'items.name': pattern }, { $set: { 'items.$[line].name': update.name } }, { arrayFilters: [{ 'line.name': pattern }] });
      await Restock.updateMany({ 'items.name': pattern }, { $set: { 'items.$[line].name': update.name } }, { arrayFilters: [{ 'line.name': pattern }] });
    }
    res.status(200).json({ success: true, data: { name: update.name || req.params.name } });
  } catch (error) {
    next(error);
  }
};

// Corrects the count at one location, for example after counting the shelf.
exports.setStockCount = async (req, res, next) => {
  try {
    const stock = await InventoryItem.findById(req.params.stockId);
    if (!stock) throw Object.assign(new Error('Stock record not found.'), { statusCode: 404 });
    const cases = Number(req.body.cases) || 0;
    const pieces = Number(req.body.pieces) || 0;
    if (cases < 0 || pieces < 0) throw Object.assign(new Error('Counts cannot be negative.'), { statusCode: 400 });
    stock.quantity = cases * stock.piecesPerCase + pieces;
    stock.cases = Math.floor(stock.quantity / stock.piecesPerCase);
    stock.pieces = stock.quantity % stock.piecesPerCase;
    await stock.save();
    res.status(200).json({ success: true, data: stock });
  } catch (error) {
    next(error);
  }
};
