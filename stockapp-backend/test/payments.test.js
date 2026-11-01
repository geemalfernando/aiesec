// Runs against a throwaway in-memory MongoDB, never the database in .env.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const Customer = require('../models/Customer');
const InventoryItem = require('../models/InventoryItem');
const Sale = require('../models/Sale');
const Payment = require('../models/Payment');
const Restock = require('../models/Restock');
const BillPhoto = require('../models/BillPhoto');
const { today, addDays } = require('../utils/businessDate');

let mongod, server, base, item;
const day = (offset) => addDays(today(), offset).toISOString().slice(0, 10);

const call = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const sell = (customer, paymentMethod, extra = {}) => call('POST', '/api/sales/entry', {
  customerId: customer._id,
  items: [{ itemId: item._id, cases: 1, pieces: 0, piecesPerCase: 10, locationTakenFrom: 'storeA' }],
  paymentMethod,
  ...extra,
});
const collect = (customer, method, amount, extra = {}) =>
  call('POST', '/api/payments', { customerId: customer._id, method, amount, ...extra });
const cheque = (number, offset = 0) => ({ chequeNumber: number, bankName: 'BOC', chequeDate: day(offset) });
const setStatus = (id, status) => call('PATCH', `/api/payments/cheques/${id}/status`, { status });

before(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  const app = express();
  app.use(express.json());
  app.use('/api/sales', require('../routes/salesRoutes'));
  app.use('/api/payments', require('../routes/paymentRoutes'));
  app.use('/api/customers', require('../routes/customerRoutes'));
  app.use('/api/bill-photos', require('../routes/billPhotoRoutes'));
  app.use('/api/reports', require('../routes/reportRoutes'));
  app.use('/api/restocks', require('../routes/restockRoutes'));
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ success: false, message: err.message }));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  for (const model of [Sale, Payment, Customer, InventoryItem, Restock, BillPhoto]) await model.createCollection();
  await Payment.syncIndexes();
});

after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongod.stop();
});

let credit, cash;
beforeEach(async () => {
  await Promise.all([Sale, Payment, Customer, InventoryItem, Restock, BillPhoto].map((m) => m.deleteMany({})));
  item = await InventoryItem.create({ name: 'Soap', price: 100, quantity: 1000, cases: 100, pieces: 0, piecesPerCase: 10, location: 'storeA' });
  credit = await Customer.create({ name: 'Credit Shop', customerType: 'credit' });
  cash = await Customer.create({ name: 'Cash Shop', customerType: 'cash' });
});

test('a credit bill is due in 21 days by default', async () => {
  const { status, body } = await sell(credit, 'credit');
  assert.equal(status, 201);
  assert.equal(body.data.dueDate.slice(0, 10), day(21));
  assert.equal(body.data.balanceDue, 1000);
  assert.equal(body.data.paymentStatus, 'unpaid');
});

test('a cash customer can have a credit bill', async () => {
  const { status, body } = await sell(cash, 'credit');
  assert.equal(status, 201);
  assert.equal(body.data.balanceDue, 1000);
});

test('customers from before types existed can still buy on credit', async () => {
  const { insertedId } = await Customer.collection.insertOne({ name: 'Old Shop' });
  assert.equal((await sell({ _id: insertedId }, 'credit')).status, 201);
});

test('a cash sale is paid immediately and is not a bill', async () => {
  const { body } = await sell(cash, 'cash');
  assert.equal(body.data.paymentStatus, 'paid');
  assert.equal((await call('GET', '/api/sales/due-bills')).body.data.length, 0);
});

test('a part payment reduces the bill, and a full payment removes it', async () => {
  await sell(credit, 'credit');
  assert.equal((await collect(credit, 'cash', 400)).status, 201);
  let [bill] = (await call('GET', '/api/sales/due-bills')).body.data;
  assert.equal(bill.balanceDue, 600);
  assert.equal((await Sale.findById(bill._id)).paymentStatus, 'partial');
  await collect(credit, 'cash', 600);
  assert.equal((await call('GET', '/api/sales/due-bills')).body.data.length, 0);
});

test('one payment settles the oldest bill first', async () => {
  const later = await sell(credit, 'credit', { dueDate: day(10) });
  const older = await sell(credit, 'credit', { dueDate: day(5) });
  await collect(credit, 'cash', 1500);
  assert.equal((await Sale.findById(older.body.data._id)).balanceDue, 0);
  assert.equal((await Sale.findById(later.body.data._id)).balanceDue, 500);
});

test('paying more than is owed is refused and changes nothing', async () => {
  const { body } = await sell(credit, 'credit');
  assert.equal((await collect(credit, 'cash', 1000.01)).status, 400);
  assert.equal((await Sale.findById(body.data._id)).balanceDue, 1000);
  assert.equal(await Payment.countDocuments(), 0);
});

test('a bill stays unpaid in money terms until its cheque clears', async () => {
  const { body } = await sell(credit, 'credit');
  const paid = await collect(credit, 'cheque', 1000, cheque('100'));
  let sale = await Sale.findById(body.data._id);
  assert.equal(sale.paymentStatus, 'cheque_pending');
  assert.equal(sale.amountPaid, 0);
  await setStatus(paid.body.data._id, 'deposited');
  assert.equal((await Sale.findById(sale._id)).paymentStatus, 'cheque_pending');
  await setStatus(paid.body.data._id, 'cleared');
  sale = await Sale.findById(sale._id);
  assert.equal(sale.paymentStatus, 'paid');
  assert.equal(sale.amountPaid, 1000);
});

test('a bounced cheque puts the amount back on the bill', async () => {
  const { body } = await sell(credit, 'credit');
  const paid = await collect(credit, 'cheque', 1000, cheque('101'));
  await setStatus(paid.body.data._id, 'deposited');
  assert.equal((await setStatus(paid.body.data._id, 'bounced')).status, 200);
  const sale = await Sale.findById(body.data._id);
  assert.equal(sale.balanceDue, 1000);
  assert.equal(sale.paymentStatus, 'unpaid');
  assert.equal((await call('GET', '/api/sales/due-bills')).body.data.length, 1);
});

test('a post-dated cheque cannot be deposited early', async () => {
  await sell(credit, 'credit');
  const paid = await collect(credit, 'cheque', 1000, cheque('102', 3));
  const res = await setStatus(paid.body.data._id, 'deposited');
  assert.equal(res.status, 400);
  assert.equal((await Payment.findById(paid.body.data._id)).chequeStatus, 'pending');
});

test('statuses cannot be skipped or reversed', async () => {
  await sell(credit, 'credit');
  const paid = await collect(credit, 'cheque', 1000, cheque('103'));
  assert.equal((await setStatus(paid.body.data._id, 'cleared')).status, 409);
  await setStatus(paid.body.data._id, 'deposited');
  await setStatus(paid.body.data._id, 'cleared');
  assert.equal((await setStatus(paid.body.data._id, 'bounced')).status, 409);
  assert.equal((await Sale.findOne()).amountPaid, 1000);
});

test('the same cheque cannot be recorded twice, but a bounced one can be presented again', async () => {
  await sell(credit, 'credit');
  const first = await collect(credit, 'cheque', 400, cheque('104'));
  assert.equal((await collect(credit, 'cheque', 400, cheque('104'))).status, 409);
  await setStatus(first.body.data._id, 'deposited');
  await setStatus(first.body.data._id, 'bounced');
  assert.equal((await collect(credit, 'cheque', 400, cheque('104'))).status, 201);
});

test('a cheque sale from a cash customer is tracked, and is owed if it bounces', async () => {
  const { status, body } = await sell(cash, 'cheque', { cheque: cheque('105') });
  assert.equal(status, 201);
  assert.equal(body.data.paymentStatus, 'cheque_pending');
  const tracker = (await call('GET', '/api/payments/cheques')).body.data;
  assert.equal(tracker.dueToday.length, 1);
  await setStatus(tracker.dueToday[0]._id, 'deposited');
  await setStatus(tracker.dueToday[0]._id, 'bounced');
  assert.equal((await Sale.findById(body.data._id)).balanceDue, 1000);
});

test('a cheque sale without details is refused and stock is untouched', async () => {
  assert.equal((await sell(cash, 'cheque')).status, 400);
  assert.equal((await InventoryItem.findById(item._id)).quantity, 1000);
});

test('the tracker sorts cheques by what needs doing', async () => {
  await sell(credit, 'credit');
  await collect(credit, 'cheque', 100, cheque('201', -2));
  await collect(credit, 'cheque', 100, cheque('202', 0));
  await collect(credit, 'cheque', 100, cheque('203', 5));
  const { missed, dueToday, upcoming } = (await call('GET', '/api/payments/cheques')).body.data;
  assert.deepEqual([missed, dueToday, upcoming].map((l) => l[0].chequeNumber), ['201', '202', '203']);
  assert.equal(dueToday[0].customer.name, 'Credit Shop');
});

test('bills from before payments existed count as fully owed and can be paid', async () => {
  const { insertedId } = await Sale.collection.insertOne({
    customer: credit._id, items: [], totalAmount: 500, paymentMethod: 'credit', dueDate: addDays(today(), 2),
  });
  assert.equal((await call('GET', '/api/sales/due-bills')).body.data[0].balanceDue, 500);
  assert.equal((await collect(credit, 'cash', 500)).status, 201);
  assert.equal((await Sale.findById(insertedId)).paymentStatus, 'paid');
});

test('pages work without any login', async () => {
  const res = await fetch(`${base}/api/payments/cheques`);
  assert.equal(res.status, 200);
});

test('a bill keeps its own rate, and a free line of the same stock takes stock too', async () => {
  const line = { itemId: item._id, cases: 0, piecesPerCase: 10, locationTakenFrom: 'storeA' };
  const { status, body } = await call('POST', '/api/sales/entry', {
    customerId: credit._id,
    paymentMethod: 'credit',
    items: [{ ...line, pieces: 5, priceAtSale: 90 }, { ...line, pieces: 3, priceAtSale: 0 }],
  });
  assert.equal(status, 201);
  assert.equal(body.data.totalAmount, 450);
  assert.equal((await InventoryItem.findById(item._id)).quantity, 992);
});

test('paid and free lines together cannot exceed the stock', async () => {
  await InventoryItem.updateOne({ _id: item._id }, { quantity: 6 });
  const line = { itemId: item._id, cases: 0, piecesPerCase: 10, locationTakenFrom: 'storeA' };
  const { status } = await call('POST', '/api/sales/entry', {
    customerId: credit._id,
    paymentMethod: 'cash',
    items: [{ ...line, pieces: 5, priceAtSale: 90 }, { ...line, pieces: 3, priceAtSale: 0 }],
  });
  assert.equal(status, 400);
  assert.equal((await InventoryItem.findById(item._id)).quantity, 6);
});

test('the same bill number cannot be entered twice', async () => {
  assert.equal((await sell(credit, 'credit', { billNumber: '45098' })).status, 201);
  assert.equal((await sell(credit, 'credit', { billNumber: '45098' })).status, 409);
  assert.equal((await InventoryItem.findById(item._id)).quantity, 990);
});

test('21 days count from the bill date', async () => {
  const { body } = await sell(credit, 'credit', { billDate: '2026-10-26' });
  assert.equal(body.data.dueDate.slice(0, 10), '2026-11-16');
});

test('a sale takes stock out', async () => {
  assert.equal((await sell(credit, 'cash')).status, 201);
  assert.equal((await InventoryItem.findById(item._id)).quantity, 990);
});

test('a sale never adds stock, even if asked to', async () => {
  await InventoryItem.updateOne({ _id: item._id }, { quantity: 6, cases: 0, pieces: 6 });
  const { status, body } = await call('POST', '/api/sales/entry', {
    customerId: credit._id,
    paymentMethod: 'cash',
    items: [{ itemId: item._id, topUp: true, cases: 0, pieces: 9, piecesPerCase: 10, locationTakenFrom: 'storeA', priceAtSale: 90 }],
  });
  assert.equal(status, 400);
  assert.match(body.message, /Insufficient stock/);
  assert.equal((await InventoryItem.findById(item._id)).quantity, 6);
});

test('a sale never creates items', async () => {
  const { status } = await call('POST', '/api/sales/entry', {
    customerId: credit._id,
    paymentMethod: 'cash',
    items: [{ name: 'Ghost', newItem: true, topUp: true, cases: 0, pieces: 1, piecesPerCase: 1, locationTakenFrom: 'storeA', priceAtSale: 1 }],
  });
  assert.equal(status, 400);
  assert.equal(await InventoryItem.countDocuments({ name: 'Ghost' }), 0);
});

test('a sale can update the MRP of a known item', async () => {
  await call('POST', '/api/sales/entry', {
    customerId: credit._id,
    paymentMethod: 'cash',
    items: [{ itemId: item._id, mrp: 175, cases: 0, pieces: 9, piecesPerCase: 10, locationTakenFrom: 'storeA', priceAtSale: 90 }],
  });
  const saved = await InventoryItem.findById(item._id);
  assert.deepEqual([saved.quantity, saved.mrp], [991, 175]);
});

test('restock then sale leaves the difference in stock', async () => {
  await call('POST', '/api/restocks', { supplierName: 'CBL', location: 'lorry1', items: [{ name: 'Rice', sellingPrice: 150, piecesPerCase: 10, cases: 10, pieces: 0, costPrice: 120 }] });
  const rice = await InventoryItem.findOne({ name: 'Rice' });
  assert.deepEqual([rice.quantity, rice.price, rice.costPrice], [100, 150, 120]);
  await call('POST', '/api/sales/entry', { customerId: credit._id, paymentMethod: 'cash', items: [{ itemId: rice._id, cases: 3, pieces: 5, piecesPerCase: 10, locationTakenFrom: 'lorry1' }] });
  const after = await InventoryItem.findById(rice._id);
  assert.deepEqual([after.quantity, after.cases, after.pieces], [65, 6, 5]);
});

const order = (extra = {}) => call('POST', '/api/restocks', {
  supplierName: 'CBL',
  location: 'storeA',
  billNumber: 'R1',
  billDate: '2026-10-20',
  items: [{ name: 'Soap', mrp: 170, piecesPerCase: 10, cases: 2, pieces: 3, costPrice: 80 }, { name: 'Sugar 1kg', mrp: 300, piecesPerCase: 12, cases: 1, pieces: 0, costPrice: 250 }],
  ...extra,
});

test('a company order adds to stock, creates new items and records cost and MRP', async () => {
  const { status, body } = await order();
  assert.equal(status, 201);
  assert.equal(body.data.totalAmount, 23 * 80 + 12 * 250);
  const soap = await InventoryItem.findById(item._id);
  assert.deepEqual([soap.quantity, soap.mrp, soap.costPrice, soap.price], [1023, 170, 80, 100]);
  const sugar = await InventoryItem.findOne({ name: 'Sugar 1kg' });
  assert.deepEqual([sugar.quantity, sugar.mrp, sugar.price, sugar.piecesPerCase, sugar.location], [12, 300, 250, 12, 'storeA']);
});

test('the same company order cannot be entered twice', async () => {
  await order();
  assert.equal((await order()).status, 409);
  assert.equal((await InventoryItem.findById(item._id)).quantity, 1023);
});

test('a company order into a new location keeps the item price and pack size', async () => {
  await order({ location: 'lorry1', items: [{ name: 'soap', piecesPerCase: 99, cases: 1, pieces: 0, costPrice: 80 }] });
  const moved = await InventoryItem.findOne({ name: 'Soap', location: 'lorry1' });
  assert.deepEqual([moved.price, moved.piecesPerCase, moved.quantity], [100, 10, 10]);
});

test('a bad company order changes nothing', async () => {
  const { status } = await order({ items: [{ name: 'Soap', piecesPerCase: 10, cases: 1, pieces: 0, costPrice: 80 }, { name: '', piecesPerCase: 1, cases: 1, pieces: 0 }] });
  assert.equal(status, 400);
  assert.equal((await InventoryItem.findById(item._id)).quantity, 1000);
  assert.equal(await Restock.countDocuments(), 0);
});

test('an item report joins stock, sales and restocks', async () => {
  await order();
  await sell(credit, 'credit', { billNumber: 'S1', billDate: '2026-10-21' });
  const { body } = await call('GET', '/api/reports/items/soap');
  assert.deepEqual([body.data.item.stock, body.data.item.sold, body.data.item.received, body.data.item.soldValue], [1013, 10, 23, 1000]);
  assert.deepEqual(body.data.movements.map((m) => [m.type, m.quantity]), [['sale', 10], ['restock', 23]]);
  assert.equal(body.data.topCustomers[0].name, 'Credit Shop');
  assert.deepEqual(body.data.monthly, [{ month: '2026-10', sold: 10, received: 23 }]);
  const list = await call('GET', '/api/reports/items');
  assert.equal(list.body.data.find((row) => row.name === 'Soap').sold, 10);
});

test('a customer report sums bills, balance and items', async () => {
  const first = await sell(credit, 'credit', { billDate: '2026-10-01', dueDate: '2026-10-22' });
  await sell(credit, 'cash', { billDate: '2026-10-05' });
  await collect(credit, 'cash', 400, { saleId: first.body.data._id });
  const { body } = await call('GET', `/api/reports/customers/${credit._id}`);
  const { summary } = body.data;
  assert.deepEqual([summary.totalSales, summary.billCount, summary.averageBill, summary.owed, summary.overdue], [2000, 2, 1000, 600, 600]);
  assert.equal(body.data.topItems[0].quantity, 20);
  assert.equal(body.data.monthly[0].total, 2000);
  const list = await call('GET', '/api/reports/customers');
  const row = list.body.data.find((c) => c.name === 'Credit Shop');
  assert.deepEqual([row.totalSales, row.owed, row.bills], [2000, 600, 2]);
});

test('renaming an item carries through its history, and a count can be corrected', async () => {
  await sell(credit, 'cash');
  assert.equal((await call('PATCH', '/api/reports/items/Soap', { name: 'Soap Bar', mrp: 175, price: 110 })).status, 200);
  const report = await call('GET', '/api/reports/items/Soap Bar');
  assert.deepEqual([report.body.data.item.sold, report.body.data.item.mrp, report.body.data.item.price], [10, 175, 110]);
  assert.equal((await call('PATCH', `/api/reports/stock/${item._id}/count`, { cases: 5, pieces: 2 })).status, 200);
  assert.equal((await InventoryItem.findById(item._id)).quantity, 52);
});

const photoDoc = (extra = {}) => BillPhoto.create({ agency: 'piliyandala', billDate: '2026-10-26', image: Buffer.from([0xff, 0xd8, 0xff]), size: 3, ...extra });

test('a saved sale marks its photo done, in the same step', async () => {
  const photo = await photoDoc();
  const { status, body } = await sell(credit, 'credit', { billPhotoId: photo._id, agency: 'piliyandala', billNumber: 'P1' });
  assert.equal(status, 201);
  const saved = await BillPhoto.findById(photo._id);
  assert.equal(saved.status, 'done');
  assert.equal(String(saved.sale), body.data._id);
  assert.equal(body.data.agency, 'piliyandala');
});

test('a photo cannot be entered twice, and the second try leaves stock alone', async () => {
  const photo = await photoDoc();
  await sell(credit, 'credit', { billPhotoId: photo._id });
  assert.equal((await sell(credit, 'credit', { billPhotoId: photo._id })).status, 409);
  assert.equal((await InventoryItem.findById(item._id)).quantity, 990);
});

test('a failed sale leaves its photo waiting', async () => {
  const photo = await photoDoc();
  await InventoryItem.updateOne({ _id: item._id }, { quantity: 1 });
  assert.equal((await sell(credit, 'credit', { billPhotoId: photo._id })).status, 400);
  assert.equal((await BillPhoto.findById(photo._id)).status, 'pending');
});

test('two agencies can use the same bill number, but one agency cannot repeat it', async () => {
  assert.equal((await sell(credit, 'cash', { billNumber: '77', agency: 'piliyandala' })).status, 201);
  assert.equal((await sell(credit, 'cash', { billNumber: '77', agency: 'katubedda' })).status, 201);
  assert.equal((await sell(credit, 'cash', { billNumber: '77', agency: 'katubedda' })).status, 409);
});

test('photos are listed by status and agency without their image data', async () => {
  await photoDoc();
  await photoDoc({ agency: 'katubedda' });
  const { body } = await call('GET', '/api/bill-photos?agency=katubedda');
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].image, undefined);
  const image = await fetch(`${base}/api/bill-photos/${body.data[0]._id}/image`);
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
  assert.equal((await call('PATCH', `/api/bill-photos/${body.data[0]._id}/status`, { status: 'skipped' })).status, 200);
  assert.equal((await call('GET', '/api/bill-photos?agency=katubedda')).body.data.length, 0);
});

test('the forecast joins stock, sales and the last company', async () => {
  await order({ items: [{ name: 'Soap', piecesPerCase: 10, cases: 1, pieces: 0, costPrice: 80 }] });
  await sell(credit, 'cash');
  await InventoryItem.updateOne({ _id: item._id }, { quantity: 2, cases: 0, pieces: 2 });
  const { body } = await call('GET', '/api/reports/forecast?leadDays=7&coverDays=14&serviceLevel=95');
  const soap = body.data.find((row) => row.name === 'Soap');
  assert.equal(soap.supplierName, 'CBL');
  assert.equal(soap.confidence, 'rough');
  assert.ok(soap.orderCases >= 1);
  assert.equal(soap.orderPieces % 10, 0);
  assert.equal(soap.estimatedCost, soap.orderPieces * 80);
});

test('a customer with open bills cannot be deleted', async () => {
  await sell(credit, 'credit');
  assert.equal((await call('DELETE', `/api/customers/${credit._id}`)).status, 409);
});
