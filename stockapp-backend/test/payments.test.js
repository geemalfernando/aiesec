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
  app.use((err, req, res, next) => res.status(err.statusCode || 500).json({ success: false, message: err.message }));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
  for (const model of [Sale, Payment, Customer, InventoryItem]) await model.createCollection();
  await Payment.syncIndexes();
});

after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongod.stop();
});

let credit, cash;
beforeEach(async () => {
  await Promise.all([Sale, Payment, Customer, InventoryItem].map((m) => m.deleteMany({})));
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

test('a cash customer cannot buy on credit, and stock is untouched', async () => {
  const { status } = await sell(cash, 'credit');
  assert.equal(status, 400);
  assert.equal((await InventoryItem.findById(item._id)).quantity, 1000);
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

test('a bill creates new items with MRP and pack size, for paid and free lines', async () => {
  const line = { name: 'Sera Table Salt 400g', newItem: true, topUp: true, mrp: 120, cases: 1, pieces: 0, piecesPerCase: 22, locationTakenFrom: 'storeB' };
  const { status, body } = await call('POST', '/api/sales/entry', {
    customerId: credit._id,
    paymentMethod: 'credit',
    items: [{ ...line, priceAtSale: 90 }, { ...line, cases: 0, pieces: 3, priceAtSale: 0 }],
  });
  assert.equal(status, 201);
  assert.equal(body.data.totalAmount, 1980);
  assert.equal(body.data.items[0].mrp, 120);
  const saved = await InventoryItem.find({ name: 'Sera Table Salt 400g' });
  assert.equal(saved.length, 1);
  assert.deepEqual([saved[0].mrp, saved[0].price, saved[0].piecesPerCase, saved[0].quantity], [120, 90, 22, 0]);
});

test('a bill line adds missing stock and updates the MRP of a known item', async () => {
  await InventoryItem.updateOne({ _id: item._id }, { quantity: 6, cases: 0, pieces: 6 });
  const { status } = await call('POST', '/api/sales/entry', {
    customerId: credit._id,
    paymentMethod: 'cash',
    items: [{ itemId: item._id, topUp: true, mrp: 175, cases: 0, pieces: 9, piecesPerCase: 10, locationTakenFrom: 'storeA', priceAtSale: 90 }],
  });
  assert.equal(status, 201);
  const saved = await InventoryItem.findById(item._id);
  assert.deepEqual([saved.quantity, saved.mrp], [0, 175]);
});

test('a failed bill leaves no new items behind', async () => {
  const { status } = await call('POST', '/api/sales/entry', {
    customerId: cash._id,
    paymentMethod: 'credit',
    items: [{ name: 'Ghost', newItem: true, topUp: true, cases: 0, pieces: 1, piecesPerCase: 1, locationTakenFrom: 'storeA', priceAtSale: 1 }],
  });
  assert.equal(status, 400);
  assert.equal(await InventoryItem.countDocuments({ name: 'Ghost' }), 0);
});

test('a customer with open bills cannot be deleted', async () => {
  await sell(credit, 'credit');
  assert.equal((await call('DELETE', `/api/customers/${credit._id}`)).status, 409);
});
