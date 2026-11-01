// Runs against a throwaway in-memory MongoDB, never the database in .env.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

process.env.JWT_SECRET = 'test-secret';

const User = require('../models/User');
const Customer = require('../models/Customer');
const InventoryItem = require('../models/InventoryItem');
const Sale = require('../models/Sale');
const Payment = require('../models/Payment');
const { today, addDays } = require('../utils/businessDate');

let mongod, server, base, adminToken, userToken, item;
const day = (offset) => addDays(today(), offset).toISOString().slice(0, 10);

const call = async (method, path, body, token = adminToken) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
  for (const model of [Sale, Payment, Customer, InventoryItem, User]) await model.createCollection();
  await Payment.syncIndexes();
});

after(async () => {
  server.close();
  await mongoose.disconnect();
  await mongod.stop();
});

let credit, cash;
beforeEach(async () => {
  await Promise.all([Sale, Payment, Customer, InventoryItem, User].map((m) => m.deleteMany({})));
  const admin = await User.collection.insertOne({ username: 'a', email: 'a@x.lk', password: 'x', role: 'admin' });
  const user = await User.collection.insertOne({ username: 'u', email: 'u@x.lk', password: 'x', role: 'user' });
  adminToken = jwt.sign({ id: admin.insertedId }, process.env.JWT_SECRET);
  userToken = jwt.sign({ id: user.insertedId }, process.env.JWT_SECRET);
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

test('staff can collect, but only an admin can change a cheque status', async () => {
  await sell(credit, 'credit');
  const paid = await call('POST', '/api/payments',
    { customerId: credit._id, method: 'cheque', amount: 100, ...cheque('300') }, userToken);
  assert.equal(paid.status, 201);
  const res = await call('PATCH', `/api/payments/cheques/${paid.body.data._id}/status`, { status: 'deposited' }, userToken);
  assert.equal(res.status, 403);
});

test('a customer with open bills cannot be deleted', async () => {
  await sell(credit, 'credit');
  assert.equal((await call('DELETE', `/api/customers/${credit._id}`)).status, 409);
});
